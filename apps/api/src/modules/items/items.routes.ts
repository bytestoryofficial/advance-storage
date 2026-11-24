import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';

import { itemIdParamsSchema, listItemsQuerySchema } from './items.schemas.js';
import { getItemById, listItems } from './items.service.js';

import { validate } from '../../lib/validate.js';

import type { IItemDetails, IItemsPage } from './items.types.js';
import type { IAppEnv } from '../../types.js';

/**
 * Catalog items. Only HTTP concerns live here: validation, status codes, JSON.
 * The data access is in `items.service.ts`, so it can be reused by the worker or tests.
 *
 * Type is inferred on purpose: an explicit `Hono<IAppEnv>` would erase the route types used by `hc`.
 */
export const itemRoutes = new Hono<IAppEnv>()
  .get('/', validate('query', listItemsQuerySchema), async (context) => {
    const page: IItemsPage = await listItems(context.req.valid('query'));
    return context.json(page);
  })
  .get('/:id', validate('param', itemIdParamsSchema), async (context) => {
    const { id } = context.req.valid('param');
    const item: IItemDetails | null = await getItemById(id);

    if (!item) {
      throw new HTTPException(404, { message: `Item ${id} not found` });
    }

    return context.json(item);
  });
