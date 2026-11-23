import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { Level, Logger } from 'pino';

import { logger } from '../lib/logger.js';

import { type IAppEnv } from '../types.js';

// ============================================ CONSTANTS ============================================

/** Health checks run every few seconds: keep them out of normal logs. */
const QUIET_PATHS: ReadonlySet<string> = new Set(['/health/live', '/health/ready']);

// ============================================ HELPERS ============================================

/** 5xx → error, 4xx → warn, the rest → info (or debug for health checks). */
const levelFor = (status: number, path: string): Level => {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';

  return QUIET_PATHS.has(path) ? 'debug' : 'info';
};

// ============================================ PUBLIC API ============================================

/**
 * Gives each request a child logger tagged with its `requestId`
 * (available as `c.get('logger')`) and logs one line when the response is ready.
 *
 * Must run after `requestId()`. Errors thrown by handlers are already turned into
 * a response by `onError` when `next()` returns, so the logged status is the real one.
 * The path is logged without the query string, so tokens in `?…` never reach the logs.
 */
export const requestLogger = createMiddleware<IAppEnv>(
  async (context: Context<IAppEnv>, next: Next): Promise<void> => {
    const requestId = context.get('requestId');
    const startedAt: number = performance.now();

    const log: Logger = logger.child({ requestId });
    context.set('logger', log);

    await next();

    const status: number = context.res.status;
    const level: Level = levelFor(status, context.req.path);

    log[level](
      {
        method: context.req.method,
        path: context.req.path,
        status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'request completed',
    );
  },
);
