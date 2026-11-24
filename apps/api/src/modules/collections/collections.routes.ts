import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';

import { validate } from '../../lib/validate.js';

import { collectionSlugParamsSchema, listCollectionsQuerySchema } from './collections.schemas.js';
import type { ICollectionDetails, ICollectionsPage } from './collections.types.js';
import { getCollectionById, listCollections } from './collections.service.js';

import { type IAppEnv } from '../../types.js';

/**
 * Catalog collections (cases, sets, events). Only HTTP concerns live here.
 *
 * Type is inferred on purpose: an explicit `Hono<IAppEnv>` would erase the route types used by `hc`.
 */
export const collectionRoutes = new Hono<IAppEnv>()
  .get('/', validate('query', listCollectionsQuerySchema), async (context) => {
    const page: ICollectionsPage = await listCollections(context.req.valid('query'));
    return context.json(page);
  })
  .get('/:slug', validate('param', collectionSlugParamsSchema), async (context) => {
    const { slug } = context.req.valid('param');
    const collection: ICollectionDetails | null = await getCollectionById(slug);

    if (!collection) throw new HTTPException(404, { message: `Collection ${slug} not found` });

    return context.json(collection);
  });
