import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@advance-storage/db';

import { seedCatalog, type ICatalogFixture } from '../../../test/fixtures.js';
import type { IErrorBody } from '../../lib/http-error.js';
import { resetDb } from '../../../test/reset-db.js';
import { getJson } from '../../../test/http.js';

import type { IItemDetails, IItemListEntry, IItemsPage } from './items.types.js';

const BASE: string = '/api/v1/items';

let fixture: ICatalogFixture;

beforeEach(async (): Promise<void> => {
  await resetDb();
  fixture = await seedCatalog();
});

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

/** nexoIds of a page, sorted, so assertions don't depend on id order. */
const nexoIdsOf = (items: IItemListEntry[]): (string | null)[] =>
  items.map((item: IItemListEntry): string | null => item.nexoId).sort();

describe('GET /items', () => {
  it('returns every item and no next page when everything fits', async () => {
    const { status, body } = await getJson<IItemsPage>(`${BASE}?limit=10`);

    expect(status).toBe(200);
    expect(nexoIdsOf(body.items)).toEqual(['axe', 'helmet', 'sword']);
    expect(body.nextCursor).toBeNull();
  });

  it('paginates with a cursor: pages do not overlap and together contain every item', async () => {
    const first = await getJson<IItemsPage>(`${BASE}?limit=2`);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await getJson<IItemsPage>(
      `${BASE}?limit=2&cursor=${first.body.nextCursor ?? ''}`,
    );
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const all: IItemListEntry[] = [...first.body.items, ...second.body.items];
    expect(nexoIdsOf(all)).toEqual(['axe', 'helmet', 'sword']);
  });

  it('filters by kind', async () => {
    const { body } = await getJson<IItemsPage>(`${BASE}?kind=armor`);
    expect(nexoIdsOf(body.items)).toEqual(['helmet']);
  });

  it('filters by collection slug', async () => {
    const { body } = await getJson<IItemsPage>(`${BASE}?collection=winter-case`);
    expect(nexoIdsOf(body.items)).toEqual(['helmet', 'sword']);
  });

  it('searches by Russian name, case-insensitive', async () => {
    const { body } = await getJson<IItemsPage>(`${BASE}?q=${encodeURIComponent('меч')}`);
    expect(nexoIdsOf(body.items)).toEqual(['sword']);
  });

  it('searches by alias', async () => {
    const { body } = await getJson<IItemsPage>(`${BASE}?q=blade`);
    expect(nexoIdsOf(body.items)).toEqual(['sword']);
  });

  it('rejects a malformed cursor with 400 and per-field details', async () => {
    const { status, body } = await getJson<IErrorBody>(`${BASE}?cursor=not-a-uuid`);

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.[0]?.path).toBe('cursor');
  });
});

describe('GET /items/:id', () => {
  it('returns the item with aliases and drops, chance in percent', async () => {
    const { status, body } = await getJson<IItemDetails>(`${BASE}/${fixture.swordId}`);

    expect(status).toBe(200);
    expect(body.nexoId).toBe('sword');
    expect(body.aliases).toEqual(['blade_cmd']);
    expect(body.drops).toEqual([
      {
        collectionSlug: 'winter-case',
        collectionNameRu: 'Зимний кейс',
        editionNo: 1,
        slotOrder: 1,
        dropChancePercent: 2.5,
      },
    ]);
  });

  it('returns null for an unknown drop chance', async () => {
    const { body } = await getJson<IItemDetails>(`${BASE}/${fixture.helmetId}`);
    expect(body.drops[0]?.dropChancePercent).toBeNull();
  });

  it('answers 404 for an id that does not exist', async () => {
    const missingId: string = '019a0000-0000-7000-8000-000000000000';
    const { status, body } = await getJson<IErrorBody>(`${BASE}/${missingId}`);

    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 for a malformed id instead of a database error', async () => {
    const { status, body } = await getJson<IErrorBody>(`${BASE}/not-a-uuid`);

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
