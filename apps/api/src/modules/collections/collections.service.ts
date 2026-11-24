import { prisma } from '@advance-storage/db';

import type { IListCollectionsQuery } from './collections.schemas.js';
import {
  type IListCollectionEntry,
  type ICollectionsPage,
  COLLECTIONS_SELECT,
  type ICollectionDetails,
  type ICollectionEdition,
} from './collections.types.js';

// ============================================ HELPERS ============================================

/** Item count of the newest edition (highest `editionNo`); `0` if the collection has none. */
const latestItemCount = (editions: ReadonlyArray<{ _count: { items: number } }>): number =>
  editions[0]?._count.items ?? 0;

// ============================================ QUERIES ============================================

/**
 * Lists all collections, sorted by slug, with the item count of their newest edition.
 *
 * No pagination on purpose: there are only a few hundred collections.
 * Add keyset pagination (as in `listItems`) if that ever grows past ~1000.
 */
export const listCollections = async (query: IListCollectionsQuery): Promise<ICollectionsPage> => {
  const rows = await prisma.collection.findMany({
    where: {
      kind: query.kind,
      OR: query.q
        ? [
            { nameRu: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    },
    select: {
      ...COLLECTIONS_SELECT,
      editions: {
        select: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { editionNo: 'desc' },
        take: 1,
      },
    },
    orderBy: { slug: 'asc' },
  });

  return {
    collections: rows.map(({ editions, ...collection }): IListCollectionEntry => ({
      ...collection,
      itemCount: latestItemCount(editions),
    })),
  };
};

/**
 * One collection with all its editions, newest first.
 *
 * @returns `null` when no collection has this slug; the route turns that into a 404.
 */
export const getCollectionById = async (slug: string): Promise<ICollectionDetails | null> => {
  const row = await prisma.collection.findUnique({
    where: { slug },
    select: {
      ...COLLECTIONS_SELECT,
      editions: {
        select: {
          editionNo: true,
          status: true,
          _count: {
            select: { items: true },
          },
        },
        orderBy: { editionNo: 'desc' },
      },
    },
  });

  if (!row) return null;

  const { editions, ...collection } = row;

  return {
    ...collection,
    itemCount: latestItemCount(editions),
    editions: editions.map((entry: (typeof editions)[number]): ICollectionEdition => ({
      editionNo: entry.editionNo,
      status: entry.status,
      itemCount: entry._count.items,
    })),
  };
};
