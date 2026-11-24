import { z } from 'zod';

import { CollectionKind } from '@advance-storage/db';

export const listCollectionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(CollectionKind).optional(),
});

export const collectionSlugParamsSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(64),
});

export type IListCollectionsQuery = z.infer<typeof listCollectionsQuerySchema>;
