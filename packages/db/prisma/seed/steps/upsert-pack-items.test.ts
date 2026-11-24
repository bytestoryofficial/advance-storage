import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { upsertPackItems } from './upsert-pack-items.js';

import { resetDb } from '../../../test/reset-db.js';

import { prisma } from '../../../src/client.js';
import type { IPackItem } from '../contract.js';

import type { TTx } from '../types.js';

// ============================================ HELPERS ============================================

/** A valid pack item; override only what the test is about. */
const packItem = (overrides: Partial<IPackItem> = {}): IPackItem => ({
  nexoId: 'test_sword',
  nameRu: 'Тестовый меч',
  kind: 'weapon',
  customModelData: ['test_sword_cmd'],
  modelRef: 'models/test_sword.json',
  modelKind: '3d',
  animated: false,
  ...overrides,
});

const runUpsert = (items: IPackItem[]): Promise<Map<string, string>> =>
  prisma.$transaction((tx: TTx) => upsertPackItems(tx, items));

// ============================================ TESTS ============================================

beforeEach(resetDb);

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

describe('upsertPackItems', () => {
  it('creates items with their aliases and returns an id for every nexoId', async () => {
    const ids: Map<string, string> = await runUpsert([
      packItem(),
      packItem({ nexoId: 'test_axe', customModelData: ['axe_a', 'axe_b'] }),
    ]);

    expect([...ids.keys()].sort()).toEqual(['test_axe', 'test_sword']);
    expect(await prisma.item.count()).toBe(2);
    expect(await prisma.itemAlias.count()).toBe(3);
  });

  it('is idempotent: a second run keeps the same ids and creates nothing', async () => {
    const first: Map<string, string> = await runUpsert([packItem()]);
    const second: Map<string, string> = await runUpsert([packItem()]);

    expect(second.get('test_sword')).toBe(first.get('test_sword'));
    expect(await prisma.item.count()).toBe(1);
    expect(await prisma.itemAlias.count()).toBe(1);
  });

  it('takes the last one when the input repeats a nexoId', async () => {
    await runUpsert([packItem({ kind: 'weapon' }), packItem({ kind: 'tool' })]);

    const item = await prisma.item.findUniqueOrThrow({ where: { nexoId: 'test_sword' } });
    expect(item.kind).toBe('tool');
  });

  it('keeps name_ru on conflict, so manual edits survive a re-import', async () => {
    await runUpsert([packItem({ nameRu: 'Старое имя' })]);
    await prisma.item.update({ where: { nexoId: 'test_sword' }, data: { nameRu: 'Исправлено' } });
    await runUpsert([packItem({ nameRu: 'Старое имя' })]);

    const item = await prisma.item.findUniqueOrThrow({ where: { nexoId: 'test_sword' } });
    expect(item.nameRu).toBe('Исправлено');
  });
});
