import { prisma } from '@advance-storage/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { IErrorBody } from '../../lib/http-error.js';
import { seedCatalog } from '../../../test/fixtures.js';
import { resetDb } from '../../../test/reset-db.js';
import { getJson } from '../../../test/http.js';

import type {
  ICollectionDetails,
  ICollectionsPage,
  IListCollectionEntry,
} from './collections.types.js';

const BASE: string = '/api/v1/collections';

beforeEach(async (): Promise<void> => {
  await resetDb();
  await seedCatalog();
});

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

const slugsOf = (collections: IListCollectionEntry[]): string[] =>
  collections.map((collection: IListCollectionEntry): string => collection.slug);

describe('GET /collections', () => {
  it('lists every collection sorted by slug, with the latest edition item count', async () => {
    const { status, body } = await getJson<ICollectionsPage>(BASE);

    expect(status).toBe(200);
    expect(slugsOf(body.collections)).toEqual(['summer-set', 'winter-case']);
    expect(body.collections[1]?.itemCount).toBe(2);
  });

  it('filters by kind', async () => {
    const { body } = await getJson<ICollectionsPage>(`${BASE}?kind=set`);
    expect(slugsOf(body.collections)).toEqual(['summer-set']);
  });

  it('searches by name', async () => {
    const { body } = await getJson<ICollectionsPage>(`${BASE}?q=${encodeURIComponent('зимн')}`);
    expect(slugsOf(body.collections)).toEqual(['winter-case']);
  });
});

describe('GET /collections/:slug', () => {
  it('returns the collection with its editions, newest first', async () => {
    const { status, body } = await getJson<ICollectionDetails>(`${BASE}/winter-case`);

    expect(status).toBe(200);
    expect(body.slug).toBe('winter-case');
    expect(body.editions).toEqual([{ editionNo: 1, status: 'active', itemCount: 2 }]);
  });

  it('answers 404 for an unknown slug', async () => {
    const { status, body } = await getJson<IErrorBody>(`${BASE}/no-such-case`);

    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 for a slug with invalid characters', async () => {
    const { status } = await getJson<IErrorBody>(`${BASE}/BAD_SLUG`);
    expect(status).toBe(400);
  });
});
