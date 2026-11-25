import { requestId } from 'hono/request-id';
import { Hono } from 'hono';

import { requestLogger } from './middleware/request-logger.js';
import { notFound, onError } from './middleware/error-handler.js';

import { collectionRoutes } from './modules/collections/collections.routes.js';
import { itemRoutes } from './modules/items/items.routes.js';
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
  app.notFound(notFound);
  app.onError(onError);

  app.route('/api/v1/items', itemRoutes);
  app.route('/api/v1/collections', collectionRoutes);
  app.route('/health', healthRoutes);

  return app;
};
