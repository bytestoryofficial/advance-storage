import { getConnInfo } from '@hono/node-server/conninfo';
import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';

import { errorBody } from './http-error.js';
import { KEY_PREFIX } from './cache.js';
import { logger } from './logger.js';
import { redis } from './redis.js';

import type { IAppEnv } from '../types.js';

import { env } from '../env.js';

// ============================================ CONSTANTS ============================================

export const REDIS_LIMIT_PREFIX = 'rl:';
export const HEADER_IP_TOKEN = 'x-real-ip';
export const CLIENT_IP_UNKNOWN = 'unknown';

export const RATE_LIMIT_HEADER = 'RateLimit-Limit';
export const RATE_REMAINING_HEADER = 'RateLimit-Remaining';
export const RATE_RESET_HEADER = 'RateLimit-Reset';
export const RETRY_AFTER_HEADER = 'Retry-After';

// ============================================ TYPES ============================================

export interface IRateLimitStore {
  /**
   * Counts one hit for `key` and returns the new total,
   * or `null` if the store is unavailable (the limiter then lets the request through).
   */
  hit(key: string, windowSeconds: number): Promise<number | null>;
}

export interface IRateLimitOptions {
  /** Separates counters of different limiters in the same store, e.g. `api`, `login`. */
  name: string;
  limit: number;
  windowSeconds: number;
  store: IRateLimitStore;
  failClosed?: boolean;
}

// ============================================ STORES ============================================

/** Production store: one Redis counter per client and window, expiring with the window. */
export const redisRateLimitStore: IRateLimitStore = {
  hit: async (key, windowSeconds) => {
    if (!redis.isReady) return null;

    try {
      const [count] = await redis
        .multi()
        .incr(`${KEY_PREFIX}${REDIS_LIMIT_PREFIX}${key}`)
        .expire(`${KEY_PREFIX}${REDIS_LIMIT_PREFIX}${key}`, windowSeconds, 'NX')
        .exec();

      return Number(count);
    } catch (error: unknown) {
      logger.warn({ err: error }, 'rate limit store failed, letting request through');
      return null;
    }
  },
};

/** Test store: same behavior, kept in memory. */
export const createMemoryRateLimitStore = (): IRateLimitStore => {
  const counts: Map<string, number> = new Map();

  return {
    hit: (key) => {
      const count: number = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return Promise.resolve(count);
    },
  };
};

// ============================================ HELPERS ============================================

/**
 * The client's IP. Behind our Nginx (`TRUST_PROXY=true`) it comes from `X-Real-IP`,
 * which Nginx overwrites. Otherwise from the socket: a client-sent header is never trusted.
 */
const clientIp = (context: Context<IAppEnv>): string => {
  if (env.TRUST_PROXY) return context.req.header(HEADER_IP_TOKEN) ?? CLIENT_IP_UNKNOWN;

  try {
    return getConnInfo(context).remote.address ?? CLIENT_IP_UNKNOWN;
  } catch {
    return CLIENT_IP_UNKNOWN;
  }
};

// ============================================ MIDDLEWARE ============================================

/**
 * Fixed-window rate limit per client IP.
 *
 * - Sets `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` on every response.
 * - Over the limit: `429` with `Retry-After` and an `IErrorBody`.
 * - Store unavailable (Redis down): fails open. A read-only catalog is better slow
 *   than offline. Login will use a stricter limiter that fails closed.
 */
export const rateLimit = (options: IRateLimitOptions) => {
  return createMiddleware<IAppEnv>(async (context: Context<IAppEnv>, next: Next) => {
    const nowSeconds: number = Math.floor(Date.now() / 1000);
    const window: number = Math.floor(nowSeconds / options.windowSeconds);
    const resetSeconds: number = options.windowSeconds - (nowSeconds % options.windowSeconds);

    const hitKey: string = `${options.name}:${clientIp(context)}:${window}`;
    const count: number | null = await options.store.hit(hitKey, options.windowSeconds);

    if (count === null) {
      if (!options.failClosed) return next();

      const requestId: string = context.get('requestId');
      return context.json(
        errorBody('SERVICE_UNAVAILABLE', 'Temporarily unavailable, try again later', requestId),
        503,
      );
    }

    context.header(RATE_LIMIT_HEADER, String(options.limit));
    context.header(RATE_REMAINING_HEADER, String(Math.max(0, options.limit - count)));
    context.header(RATE_RESET_HEADER, String(resetSeconds));

    if (count > options.limit) {
      context.header(RETRY_AFTER_HEADER, String(resetSeconds));

      const requestId: string = context.get('requestId');

      return context.json(
        errorBody('TOO_MANY_REQUESTS', 'Too many requests, try again later', requestId),
        429,
      );
    }

    await next();
  });
};
