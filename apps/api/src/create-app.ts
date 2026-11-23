import { requestId } from 'hono/request-id';
import { Hono } from 'hono';

import { requestLogger } from './middleware/request-logger.js';
import { onError } from './middleware/error-handler.js';

import { healthRoutes } from './routes/health.js';

import type { IAppEnv } from './types.js';

/**
 * Builds the Hono app: middleware first, then routes.
 * It never opens a port, so tests can call `createApp().request('/health/live')`.
 */
export const createApp = (): Hono<IAppEnv> => {
  const app: Hono<IAppEnv> = new Hono<IAppEnv>();

  app.use(requestId());
  app.use(requestLogger);
  app.onError(onError);

  app.route('/health', healthRoutes);

  return app;
};
