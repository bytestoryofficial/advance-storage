import { prisma } from '@advance-storage/db';

import {
  LIST_SELECT,
  type IItemDetails,
  type IItemDrop,
  type IItemListEntry,
  type IItemsPage,
} from './items.types.js';

import type { IListItemsQuery } from './items.schemas.js';

// ============================================ HELPERS ============================================

const bpToPercent = (bp: number | null): number | null => (bp === null ? null : bp / 100);

const getMore = (items: IItemListEntry[], hasMore: boolean): string | null =>
  hasMore ? (items.at(-1)?.id ?? null) : null;

// ============================================ QUERIES ============================================

/**
 * Lists catalog items with filters and keyset pagination.
 *
 * Keyset ("cursor") pagination: `WHERE id > :cursor ORDER BY id LIMIT n`.
 * Unlike `OFFSET`, page 50 costs the same as page 1, and rows inserted meanwhile
 * never shift the pages. It works because ids are UUID v7, ordered by creation time.
 * Sorting by another column later would need a composite cursor (`value + id`).
 *
 * Asks for `limit + 1` rows: the extra row only tells whether a next page exists.
 * `q` matches the Russian name, `nexoId` or any alias (case-insensitive).
 */
export const listItems = async (query: IListItemsQuery): Promise<IItemsPage> => {
  const rows: IItemListEntry[] = await prisma.item.findMany({
    where: {
      id: query.cursor ? { gt: query.cursor } : undefined,
      kind: query.kind,
      OR: query.q
        ? [
            { nameRu: { contains: query.q, mode: 'insensitive' } },
            { nexoId: { contains: query.q, mode: 'insensitive' } },
            { aliases: { some: { alias: { contains: query.q, mode: 'insensitive' } } } },
          ]
        : undefined,
      editions: query.collection
        ? { some: { edition: { collection: { slug: query.collection } } } }
        : undefined,
    },
    orderBy: { id: 'asc' },
    take: query.limit + 1,
    select: LIST_SELECT,
  });

  const hasMore: boolean = rows.length > query.limit;
  const items: IItemListEntry[] = hasMore ? rows.slice(0, query.limit) : rows;

  return { items, nextCursor: getMore(items, hasMore) };
};

/**
 * One item with its aliases and every case edition it drops from,
 * sorted by collection slug, then edition number.
 *
 * @returns `null` when no item has this id; the route turns that into a 404.
 */
export const getItemById = async (id: string): Promise<IItemDetails | null> => {
  const row = await prisma.item.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      eiId: true,
      aliases: { select: { alias: true }, orderBy: { alias: 'asc' } },
      editions: {
        orderBy: [{ edition: { collection: { slug: 'asc' } } }, { edition: { editionNo: 'asc' } }],
        select: {
          slotOrder: true,
          dropChanceBp: true,
          edition: {
            select: { editionNo: true, collection: { select: { slug: true, nameRu: true } } },
          },
        },
      },
    },
  });

  if (!row) return null;

  const { aliases, editions, ...item } = row;

  return {
    ...item,
    aliases: aliases.map((entry: { alias: string }): string => entry.alias),
    drops: editions.map((entry: (typeof editions)[number]): IItemDrop => ({
      collectionSlug: entry.edition.collection.slug,
      collectionNameRu: entry.edition.collection.nameRu,
      editionNo: entry.edition.editionNo,
      slotOrder: entry.slotOrder,
      dropChancePercent: bpToPercent(entry.dropChanceBp),
    })),
  };
};
