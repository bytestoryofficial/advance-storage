import { ClientClosedError, createClient } from 'redis';

import { logger } from './logger.js';

import { env } from '../env.js';

// ============================================ CONSTANTS ============================================

const CONNECT_TIMEOUT_MS = 5_000;

// ============================================ CLIENT ============================================

/**
 * Shared Redis client (cache, rate limits).
 *
 * - `disableOfflineQueue`: while disconnected, commands reject at once instead of
 *   queuing in memory. Callers must catch and fall back (e.g. read from Postgres).
 * - Reconnects use the library default: exponential backoff up to 2 s + random jitter.
 */
export const redis = createClient({
  url: env.REDIS_URL,
  disableOfflineQueue: true,
  socket: { connectTimeout: CONNECT_TIMEOUT_MS },
});

// ============================================ EVENTS ============================================

let connectionLost: boolean = false;

redis.on('error', (error: Error): void => {
  if (connectionLost) {
    logger.debug({ err: error }, 'redis still unavailable');
    return;
  }

  connectionLost = true;
  logger.error({ err: error }, 'redis connection lost, reconnecting');
});

redis.on('ready', (): void => {
  connectionLost = false;
  logger.info('redis ready');
});

// ============================================ LIFECYCLE ============================================

export const connectRedis = (): void => {
  redis.connect().catch((error: unknown): void => {
    if (error instanceof ClientClosedError) return;

    logger.error({ err: error }, 'redis connect gave up');
  });
};

export const closeRedis = async (): Promise<void> => {
  if (redis.isOpen) await redis.close();
};
