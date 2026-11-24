import { CollectionKind, prisma } from '@advance-storage/db';

import { cached, invalidate } from '../../lib/cache.js';

import type { IListCollectionsQuery } from './collections.schemas.js';

import {
  type IListCollectionEntry,
  type ICollectionsPage,
  COLLECTIONS_SELECT,
  type ICollectionDetails,
  type ICollectionEdition,
} from './collections.types.js';

// ============================================ CONSTANTS ============================================

const CATALOG_TTL_SECONDS: number = 300;

/** Single source of truth for cache keys; bump `v1` when a collection DTO changes shape. */
const collectionKeys = {
  list: (kind: CollectionKind | 'all'): string => `catalog:collections:v1:${kind}`,
  detail: (slug: string): string => `catalog:collection:v1:${slug}`,
};

// ============================================ HELPERS ============================================

/** Item count of the newest edition (highest `editionNo`); `0` if the collection has none. */
const latestItemCount = (editions: ReadonlyArray<{ _count: { items: number } }>): number =>
  editions[0]?._count.items ?? 0;

// ============================================ LOADERS (DATABASE) ============================================

const loadCollections = async (query: IListCollectionsQuery): Promise<ICollectionsPage> => {
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
    collections: rows.map(
      ({ editions, ...collection }: (typeof rows)[number]): IListCollectionEntry => ({
        ...collection,
        itemCount: latestItemCount(editions),
      }),
    ),
  };
};

const loadCollectionBySlug = async (slug: string): Promise<ICollectionDetails | null> => {
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

// ============================================ QUERIES (CACHE) ============================================

/**
 * Lists collections; cached per `kind` for {@link CATALOG_TTL_SECONDS}.
 * Searches (`q`) skip the cache: every search string would be a new key.
 */
export const listCollections = (query: IListCollectionsQuery): Promise<ICollectionsPage> => {
  if (query.q) return loadCollections(query);

  const keys = collectionKeys.list(query.kind ?? 'all');

  return cached(keys, CATALOG_TTL_SECONDS, () => loadCollections(query));
};

/**
 * One collection with its editions; cached per slug.
 * A missing slug (`null`) is not cached, so a new collection appears immediately.
 */
export const getCollectionBySlug = (slug: string): Promise<ICollectionDetails | null> => {
  return cached(collectionKeys.detail(slug), CATALOG_TTL_SECONDS, () => loadCollectionBySlug(slug));
};

// ============================================ INVALIDATION ============================================

/**
 * Drops cached collection data after a write (admin edit, seed).
 * Lists are dropped for every kind, since one change can move a collection between them.
 *
 * @param slugs - Changed collections; their detail entries are dropped too.
 */
export const invalidateCollections = async (...slugs: string[]): Promise<void> => {
  const kinds: (CollectionKind | 'all')[] = [...Object.values(CollectionKind), 'all'];
  const listKeys: string[] = kinds.map(collectionKeys.list);

  await invalidate(...listKeys, ...slugs.map(collectionKeys.detail));
};
