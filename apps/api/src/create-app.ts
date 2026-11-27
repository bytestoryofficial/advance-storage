import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

import { requestLogger } from './middleware/request-logger.js';
import { notFound, onError } from './middleware/error-handler.js';

import { errorBody } from './lib/http-error.js';
import {
  RATE_LIMIT_HEADER,
  RATE_REMAINING_HEADER,
  RATE_RESET_HEADER,
  rateLimit,
  redisRateLimitStore,
  RETRY_AFTER_HEADER,
  type IRateLimitStore,
} from './lib/rate-limit.js';

import { collectionRoutes } from './modules/collections/collections.routes.js';
import { itemRoutes } from './modules/items/items.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './routes/health.js';

import type { IAppEnv } from './types.js';
import { env } from './env.js';

// ============================================ TYPES ============================================

export interface ICreateAppOptions {
  rateLimitStore?: IRateLimitStore;
  rateLimitMax?: number;
  loginRateLimitMax?: number;
}

// ============================================ CONSTANTS ============================================
/** JSON bodies only, no uploads: 100 kb is plenty. */
const MAX_BODY_BYTES: number = 100 * 1024;
const RATE_LIMIT_WINDOW_SECONDS: number = 60;
const REQUEST_ID_HEADER = 'X-Request-Id';
const API_V1 = '/api/v1';

// ============================================ APP ============================================

/**
 * Builds the app. Middleware order matters:
 *
 * 1. `requestId`, `requestLogger`: every response, errors included, is traceable.
 * 2. `secureHeaders`, `cors`: run before anything can reject a request, so a 413 or 429
 *    still carries CORS headers. Otherwise the browser reports a CORS error instead.
 * 3. `bodyLimit`: rejects oversized bodies before anything reads them.
 * 4. `rateLimit`: only on `/api/*`; health checks must never be throttled.
 */
export const createApp = (options: ICreateAppOptions = {}): Hono<IAppEnv> => {
  const app: Hono<IAppEnv> = new Hono<IAppEnv>();

  app.use(requestId());
  app.use(requestLogger);

  app.use(secureHeaders());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowHeaders: ['Content-Type'],
      exposeHeaders: [
        REQUEST_ID_HEADER,
        RATE_LIMIT_HEADER,
        RATE_REMAINING_HEADER,
        RATE_RESET_HEADER,
        RETRY_AFTER_HEADER,
      ],
      credentials: true,
      maxAge: 600,
    }),
  );

  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (context) => {
        const requestId: string = context.get('requestId');

        return context.json(
          errorBody('PAYLOAD_TOO_LARGE', 'Request body is too large', requestId),
          413,
        );
      },
    }),
  );

  const rateLimitStore: IRateLimitStore = options.rateLimitStore ?? redisRateLimitStore;

  app.use(
    '/api/*',
    rateLimit({
      name: 'api',
      limit: options.rateLimitMax ?? env.RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      store: rateLimitStore,
    }),
  );

  app.use(
    `${API_V1}/auth/login`,
    rateLimit({
      name: 'login',
      limit: options.loginRateLimitMax ?? 10,
      windowSeconds: 15 * RATE_LIMIT_WINDOW_SECONDS,
      store: rateLimitStore,
      failClosed: true,
    }),
  );

  app.route(`${API_V1}/auth`, authRoutes);
  app.route(`${API_V1}/items`, itemRoutes);
  app.route(`${API_V1}/collections`, collectionRoutes);
  app.route('/health', healthRoutes);

  app.notFound(notFound);
  app.onError(onError);

  return app;
};
