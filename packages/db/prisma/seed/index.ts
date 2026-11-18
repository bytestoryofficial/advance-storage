import { prisma } from '../../src/client.js';

import type { ILegacyItem, IPackItem, ISeedCase, ISeedFile } from './contract';
import { loadSeedFile } from './load-seed-file';
import { SEED_FILE_URL } from './slugs';

import {
  dedupeByAlias,
  upsertLegacyItems,
  type ILegacyUpsertResult,
} from './steps/upsert-legacy-items';
import { upsertCollection } from './steps/upsert-collections';
import { upsertPackItems } from './steps/upsert-pack-items';

import type { TTx } from './types';

// ========================================== CONSTANT ===================================================

const TRANSACTION_TIMEOUT = 30_000;

// ========================================== VARS ===================================================

const seed: ISeedFile = loadSeedFile(SEED_FILE_URL);
const packItems: IPackItem[] = [
  ...seed.cases.flatMap((seedCase: ISeedCase): IPackItem[] => seedCase.items),
  ...seed.nonCaseItems,
];
const legacyItems: ILegacyItem[] = dedupeByAlias(seed.legacyItems);

const startedAt: number = performance.now();

// ========================================== TRANSACTION API ===================================================

/**
 * Seeds the catalog from the seed JSON. Idempotent: safe to run again,
 * every step is an upsert. All writes happen in one transaction.
 */

try {
  const legacy: ILegacyUpsertResult = await prisma.$transaction(
    async (tx: TTx): Promise<ILegacyUpsertResult> => {
      const itemIds: Map<string, string> = await upsertPackItems(tx, packItems);

      // Sequential on purpose: an interactive transaction has one connection
      for (const seedCase of seed.cases) {
        await upsertCollection(tx, seedCase, itemIds);
      }

      return upsertLegacyItems(tx, legacyItems);
    },
    { timeout: TRANSACTION_TIMEOUT },
  );

  const [collections, items, aliases]: [number, number, number] = await prisma.$transaction([
    prisma.collection.count(),
    prisma.item.count(),
    prisma.itemAlias.count(),
  ]);

  const ms: number = Math.round(performance.now() - startedAt);

  console.log(
    `Seeded in ${ms} ms: ${collections} collections, ${items} items, ${aliases} aliases ` +
      `(legacy: ${legacy.created} created, ${legacy.updated} updated)`,
  );
} catch (error: unknown) {
  console.error('Seed failed, transaction rolled back: ', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
