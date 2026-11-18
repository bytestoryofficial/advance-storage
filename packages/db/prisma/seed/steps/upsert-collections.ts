import type { ISeedCase } from '../contract';
import { SET_SLUGS } from '../slugs';
import type { TTx } from '../types';

// =================================== TYPES =====================================

type TSeedCaseItem = ISeedCase['items'][number];

type DropChanceByItemId = Map<string, number | null>;

interface IEditionItemChance {
  itemId: string;
  dropChanceBp: number | null;
}

// =================================== CONSTANTS =====================================

const SEED_EDITION_NO = 1;

// ========================================= SQL API ===============================================

/**
 * Upserts a seed case as a collection with edition #1 and syncs its item list.
 *
 * - Existing collection or edition: `nameRu` and `kind` are kept, so manual edits win.
 * - The item list is replaced to match the seed; `slotOrder` = position in the seed.
 * - Drop chances already set on items that stay in the edition are kept.
 *
 * Must run inside a transaction: delete + create must commit together.
 *
 * @param tx - Prisma interactive transaction client.
 * @param seedCase - Case from the seed file.
 * @param itemIds - `nexoId` -> item `id`, from `upsertPackItems`.
 * @throws If an item was not upserted, or the case lists the same item twice.
 */

export const upsertCollection = async (
  tx: TTx,
  seedCase: ISeedCase,
  itemIds: ReadonlyMap<string, string>,
): Promise<void> => {
  const caseItemIds: string[] = seedCase.items.map((item: TSeedCaseItem): string => {
    const itemId: string | undefined = itemIds.get(item.nexoId);

    if (!itemId) throw new Error(`Item ${item.nexoId} of ${seedCase.slug} was not upserted`);

    return itemId;
  });

  if (new Set(caseItemIds).size !== caseItemIds.length)
    throw new Error(`Case ${seedCase.slug} lists the same item twice`);

  const collection: { id: string } = await tx.collection.upsert({
    where: { slug: seedCase.slug },
    create: {
      slug: seedCase.slug,
      nameRu: seedCase.nameRu || null,
      kind: SET_SLUGS.has(seedCase.slug) ? 'set' : 'case',
    },
    update: {},
    select: { id: true },
  });

  const edition: { id: string } = await tx.collectionEdition.upsert({
    where: {
      collectionId_editionNo: { collectionId: collection.id, editionNo: SEED_EDITION_NO },
    },
    create: { collectionId: collection.id, editionNo: SEED_EDITION_NO },
    update: {},
    select: { id: true },
  });

  // Keep drop chances entered by hand before replacing the list
  const previous: IEditionItemChance[] = await tx.editionItem.findMany({
    where: { editionId: edition.id },
    select: { itemId: true, dropChanceBp: true },
  });

  const dropChanceByItemId: DropChanceByItemId = new Map(
    previous.map((row: IEditionItemChance): [string, number | null] => [
      row.itemId,
      row.dropChanceBp,
    ]),
  );

  await tx.editionItem.deleteMany({ where: { editionId: edition.id } });

  await tx.editionItem.createMany({
    data: caseItemIds.map((itemId: string, index: number) => ({
      editionId: edition.id,
      itemId,
      slotOrder: index + 1,
      dropChanceBp: dropChanceByItemId.get(itemId) ?? null,
    })),
  });
};
