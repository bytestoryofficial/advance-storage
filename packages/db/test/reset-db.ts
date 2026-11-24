import { prisma } from '../src/client.js';

/** Empties every catalog table, so each test starts from a known, empty state. */
export const resetDb = async (): Promise<void> => {
  await prisma.$executeRaw`
    TRUNCATE edition_item, item_alias, collection_edition, collection, item CASCADE
  `;
};
