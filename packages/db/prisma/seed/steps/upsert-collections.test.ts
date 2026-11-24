import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { upsertCollection } from './upsert-collections.js';
import { upsertPackItems } from './upsert-pack-items.js';

import { resetDb } from '../../../test/reset-db.js';

import type { IPackItem, ISeedCase } from '../contract.js';
import { prisma } from '../../../src/client.js';

import type { TTx } from '../types.js';

// ============================================ TYPES ============================================

interface ISlotRow {
  slotOrder: number;
  dropChanceBp: number | null;
  nexoId: string | null;
}

// ============================================ HELPERS ============================================

const SLUG: string = 'test-case';

/** A valid pack item with the given nexoId. */
const packItem = (nexoId: string): IPackItem => ({
  nexoId,
  nameRu: nexoId,
  kind: 'weapon',
  customModelData: [`${nexoId}_cmd`],
  modelRef: null,
  modelKind: 'unknown',
  animated: false,
});

/** A valid seed case; override only what the test is about. */
const seedCase = (items: IPackItem[], overrides: Partial<ISeedCase> = {}): ISeedCase => ({
  slug: SLUG,
  nameRu: 'Тестовый кейс',
  items,
  ...overrides,
});

/** Upserts the items, then the case, in one transaction, like the real seed. */
const runSeed = (seed: ISeedCase): Promise<void> =>
  prisma.$transaction(async (tx: TTx): Promise<void> => {
    const ids: Map<string, string> = await upsertPackItems(tx, seed.items);
    await upsertCollection(tx, seed, ids);
  });

/** The edition's slots in display order. */
const slots = async (): Promise<ISlotRow[]> => {
  const rows = await prisma.editionItem.findMany({
    where: { edition: { collection: { slug: SLUG } } },
    orderBy: { slotOrder: 'asc' },
    select: { slotOrder: true, dropChanceBp: true, item: { select: { nexoId: true } } },
  });

  return rows.map((row: (typeof rows)[number]): ISlotRow => ({
    slotOrder: row.slotOrder,
    dropChanceBp: row.dropChanceBp,
    nexoId: row.item.nexoId,
  }));
};

// ============================================ TESTS ============================================

beforeEach(resetDb);

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

describe('upsertCollection', () => {
  it('creates the collection, edition #1 and one slot per item in seed order', async () => {
    await runSeed(seedCase([packItem('a'), packItem('b'), packItem('c')]));

    const collection = await prisma.collection.findUniqueOrThrow({ where: { slug: SLUG } });
    expect(collection.kind).toBe('case');
    expect(collection.nameRu).toBe('Тестовый кейс');

    expect(await prisma.collectionEdition.count()).toBe(1);
    expect(await slots()).toEqual([
      { slotOrder: 1, dropChanceBp: null, nexoId: 'a' },
      { slotOrder: 2, dropChanceBp: null, nexoId: 'b' },
      { slotOrder: 3, dropChanceBp: null, nexoId: 'c' },
    ]);
  });

  it('is idempotent: a second run keeps one collection, one edition, the same slots', async () => {
    const seed: ISeedCase = seedCase([packItem('a'), packItem('b')]);

    await runSeed(seed);
    await runSeed(seed);

    expect(await prisma.collection.count()).toBe(1);
    expect(await prisma.collectionEdition.count()).toBe(1);
    expect(await slots()).toHaveLength(2);
  });

  it('replaces the item list: removed items go, order follows the new seed', async () => {
    await runSeed(seedCase([packItem('a'), packItem('b'), packItem('c')]));
    await runSeed(seedCase([packItem('c'), packItem('a')]));

    expect(await slots()).toEqual([
      { slotOrder: 1, dropChanceBp: null, nexoId: 'c' },
      { slotOrder: 2, dropChanceBp: null, nexoId: 'a' },
    ]);
  });

  it('keeps drop chances entered by hand for items that stay in the edition', async () => {
    await runSeed(seedCase([packItem('a'), packItem('b')]));

    // An admin sets chances by hand
    const itemA = await prisma.item.findUniqueOrThrow({ where: { nexoId: 'a' } });
    await prisma.editionItem.updateMany({
      where: { itemId: itemA.id },
      data: { dropChanceBp: 250 },
    });

    // Re-seed with a new order and a new item
    await runSeed(seedCase([packItem('c'), packItem('a')]));

    expect(await slots()).toEqual([
      { slotOrder: 1, dropChanceBp: null, nexoId: 'c' },
      { slotOrder: 2, dropChanceBp: 250, nexoId: 'a' },
    ]);
  });

  it('keeps a name edited by hand on re-seed', async () => {
    await runSeed(seedCase([packItem('a')]));
    await prisma.collection.update({ where: { slug: SLUG }, data: { nameRu: 'Исправлено' } });

    await runSeed(seedCase([packItem('a')], { nameRu: 'Тестовый кейс' }));

    const collection = await prisma.collection.findUniqueOrThrow({ where: { slug: SLUG } });
    expect(collection.nameRu).toBe('Исправлено');
  });

  it('rejects a case that lists the same item twice, and writes nothing', async () => {
    const seed: ISeedCase = seedCase([packItem('a'), packItem('a')]);

    await expect(runSeed(seed)).rejects.toThrow('lists the same item twice');

    // The whole transaction rolled back, the items too
    expect(await prisma.collection.count()).toBe(0);
    expect(await prisma.item.count()).toBe(0);
  });

  it('rejects an item that was not upserted before the case', async () => {
    const seed: ISeedCase = seedCase([packItem('a')]);

    await expect(
      prisma.$transaction((tx: TTx) => upsertCollection(tx, seed, new Map())),
    ).rejects.toThrow('was not upserted');

    expect(await prisma.collection.count()).toBe(0);
  });
});
