import { Hono, type Next } from 'hono';

import { prisma } from '@advance-storage/db';

import { isShuttingDown, SHUTTING_DOWN_STATUS } from '../lib/shutdown-state.js';
import { redis } from '../lib/redis.js';

import type { IAppEnv } from '../types.js';

// ============================================ CONSTANTS ============================================

/** Above this, the database counts as down: a hung check is worse than a 503. */
const DB_PING_TIMEOUT_MS = 2_000;

// ============================================ HELPERS ============================================

/** Runs `SELECT 1`; rejects if it fails or takes longer than {@link DB_PING_TIMEOUT_MS}. */
const pingDatabase = async (): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout: Promise<never> = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Database ping timed out after ${DB_PING_TIMEOUT_MS} ms`)),
      DB_PING_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

// ============================================ ROUTES ============================================

/**
 * Health checks for Docker and the load balancer.
 *
 * - `/live`: is the process able to answer? Never touches dependencies,
 *   otherwise a database outage would make Docker restart a healthy API in a loop.
 * - `/ready`: can it serve real requests? Checks the database, with a timeout.
 *
 * Type is inferred on purpose: an explicit `Hono<IAppEnv>` would erase the route types used by `hc`.
 */
export const healthRoutes = new Hono<IAppEnv>()
  .use(async (context, next: Next) => {
    await next();
    context.header('Cache-Control', 'no-store');
  })
  .get('/live', (context) => context.json({ status: 'ok' }))
  .get('/ready', async (context) => {
    if (isShuttingDown()) return context.json({ status: SHUTTING_DOWN_STATUS }, 503);

    const cache = redis.isReady ? 'up' : 'down';

    try {
      await pingDatabase();
    } catch (error: unknown) {
      context.get('logger').warn({ error }, 'readiness check failed');
      return context.json({ status: 'unavailable', db: 'down', cache }, 503);
    }

    const status = cache === 'up' ? 'ok' : 'degraded';
    return context.json({ status: status, db: 'up', cache });
  });
