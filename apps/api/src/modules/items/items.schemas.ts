import { ItemKind } from '@advance-storage/db';

import { z } from 'zod';

/** `GET /api/items` query string. Everything arrives as a string, so numbers are coerced.
 * q: case-insensitive search in the Russian name and the nexo id.
 * collections: slug, e.g. `bahamut`.
 * cursor: Id of the last item of the previous page (keyset pagination).
 */
export const listItemsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(ItemKind).optional(),
  collection: z.string().trim().min(1).max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

/** `GET /api/items/:id` path parameters. */
export const itemIdParamsSchema = z.object({
  id: z.uuid(),
});

export type IListItemsQuery = z.infer<typeof listItemsQuerySchema>;
