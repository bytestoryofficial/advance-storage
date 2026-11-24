import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { legacyKind, upsertLegacyItems, type ILegacyUpsertResult } from './upsert-legacy-items.js';
import { upsertPackItems } from './upsert-pack-items.js';

import { resetDb } from '../../../test/reset-db.js';

import type { ILegacyItem, IPackItem } from '../contract.js';
import { prisma } from '../../../src/client.js';

import type { TTx } from '../types.js';

// ============================================ HELPERS ============================================

/** A valid legacy item; override only what the test is about. */
const legacyItem = (overrides: Partial<ILegacyItem> = {}): ILegacyItem => ({
  alias: 'old_helmet',
  baseItem: 'minecraft:diamond_helmet',
  modelRef: 'models/old_helmet.json',
  modelKind: '3d',
  animated: false,
  ...overrides,
});

/** A valid pack item, used to check that legacy data never overwrites it. */
const packItem = (overrides: Partial<IPackItem> = {}): IPackItem => ({
  nexoId: 'pack_sword',
  nameRu: 'Меч из пака',
  kind: 'weapon',
  customModelData: ['pack_sword_cmd'],
  modelRef: 'models/pack_sword.json',
  modelKind: '3d',
  animated: false,
  ...overrides,
});

const runLegacy = (items: ILegacyItem[]): Promise<ILegacyUpsertResult> =>
  prisma.$transaction((tx: TTx) => upsertLegacyItems(tx, items));

const runPack = (items: IPackItem[]): Promise<Map<string, string>> =>
  prisma.$transaction((tx: TTx) => upsertPackItems(tx, items));

/** The item an alias points to; throws if the alias does not exist. */
const itemByAlias = async (alias: string) => {
  const row = await prisma.itemAlias.findUniqueOrThrow({
    where: { alias },
    select: { item: true },
  });

  return row.item;
};

// ============================================ UNIT: legacyKind ============================================

describe('legacyKind', () => {
  it.each([
    ['diamond_helmet', 'armor'],
    ['minecraft:netherite_boots', 'armor'],
    ['fishing_rod', 'tool'],
    ['minecraft:shears', 'tool'],
    ['diamond_sword', 'other'],
    ['stone', 'other'],
  ])('%s → %s', (baseItem: string, expected: string) => {
    expect(legacyKind(baseItem)).toBe(expected);
  });
});

// ============================================ INTEGRATION: upsertLegacyItems ============================================

beforeEach(resetDb);

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

describe('upsertLegacyItems', () => {
  it('creates an item and its alias in one statement, with the kind guessed from baseItem', async () => {
    const result: ILegacyUpsertResult = await runLegacy([legacyItem()]);

    expect(result).toEqual({ created: 1, updated: 0 });

    const item = await itemByAlias('old_helmet');
    expect(item.kind).toBe('armor');
    expect(item.nexoId).toBeNull();
    expect(item.modelRef).toBe('models/old_helmet.json');
  });

  it('returns an empty result for empty input without touching the database', async () => {
    const result: ILegacyUpsertResult = await runLegacy([]);

    expect(result).toEqual({ created: 0, updated: 0 });
    expect(await prisma.item.count()).toBe(0);
  });

  it('is idempotent: a second run with the same data creates and updates nothing', async () => {
    await runLegacy([legacyItem()]);
    const second: ILegacyUpsertResult = await runLegacy([legacyItem()]);

    expect(second).toEqual({ created: 0, updated: 0 });
    expect(await prisma.item.count()).toBe(1);
    expect(await prisma.itemAlias.count()).toBe(1);
  });

  it('updates an existing legacy item when its data changed', async () => {
    await runLegacy([legacyItem()]);
    const second: ILegacyUpsertResult = await runLegacy([
      legacyItem({ modelRef: 'models/old_helmet_v2.json', animated: true }),
    ]);

    expect(second).toEqual({ created: 0, updated: 1 });

    const item = await itemByAlias('old_helmet');
    expect(item.modelRef).toBe('models/old_helmet_v2.json');
    expect(item.animated).toBe(true);
  });

  it('never overwrites a pack item that owns the same alias', async () => {
    await runPack([packItem({ customModelData: ['shared_alias'] })]);

    const result: ILegacyUpsertResult = await runLegacy([
      legacyItem({ alias: 'shared_alias', baseItem: 'diamond_helmet', modelRef: null }),
    ]);

    expect(result).toEqual({ created: 0, updated: 0 });

    const item = await itemByAlias('shared_alias');
    expect(item.nexoId).toBe('pack_sword');
    expect(item.kind).toBe('weapon');
    expect(item.modelRef).toBe('models/pack_sword.json');
  });

  it('takes the last one when the input repeats an alias, without crashing', async () => {
    const result: ILegacyUpsertResult = await runLegacy([
      legacyItem({ modelRef: 'models/first.json' }),
      legacyItem({ modelRef: 'models/last.json' }),
    ]);

    expect(result).toEqual({ created: 1, updated: 0 });
    expect(await prisma.item.count()).toBe(1);

    const item = await itemByAlias('old_helmet');
    expect(item.modelRef).toBe('models/last.json');
  });
});
