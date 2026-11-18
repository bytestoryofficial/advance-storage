import type { ILegacyItem, TItemKind } from '../contract';
import type { TTx } from '../types';

// =================================== TYPES =====================================

export interface ILegacyUpsertResult {
  created: number;
  updated: number;
}

// ============================= HELPER ===================================

/**
 * Guesses an item kind from its vanilla base item, e.g. `diamond_helmet` -> `armor`.
 * Works with and without the `minecraft:` prefix. Falls back to `other`.
 */
export const legacyKind = (baseItem: string): TItemKind => {
  if (/_(helmet|chestplate|leggings|boots)$/.test(baseItem)) return 'armor';
  if (/(fishing_rod|shears)$/.test(baseItem)) return 'tool';
  return 'other';
};

/**
 * Removes items with a duplicate alias. The last one wins,
 * the same rule as in `upsertPackItems`.
 */
export const dedupeByAlias = (items: ILegacyItem[]): ILegacyItem[] => [
  ...new Map(items.map((item: ILegacyItem): [string, ILegacyItem] => [item.alias, item])).values(),
];

// ================================= SQL API ============================================

/**
 * Bulk upserts legacy items (items without a `nexoId`), matched by alias.
 *
 * - Existing alias -> updates its item, but never a pack item (`nexo_id IS NOT NULL`).
 * - New alias -> creates the item and its alias in one statement.
 * - Rows with no changes are skipped.
 *
 * Must run inside a transaction so both statements commit together.
 *
 * @param tx - Prisma interactive transaction client.
 * @param items - Legacy items parsed from screenshots or old data.
 * @returns Number of created and updated items.
 */
export const upsertLegacyItems = async (
  tx: TTx,
  items: ILegacyItem[],
): Promise<ILegacyUpsertResult> => {
  const uniqueItems: ILegacyItem[] = dedupeByAlias(items);

  if (uniqueItems.length === 0) return { created: 0, updated: 0 };

  const aliases: string[] = uniqueItems.map((item: ILegacyItem): string => item.alias);
  const kinds: string[] = uniqueItems.map((item: ILegacyItem): string => legacyKind(item.baseItem));
  const modelRefs: (string | null)[] = uniqueItems.map(
    (item: ILegacyItem): string | null => item.modelRef,
  );
  const modelKinds: string[] = uniqueItems.map((item: ILegacyItem): string => item.modelKind);
  const animated: boolean[] = uniqueItems.map((item: ILegacyItem): boolean => item.animated);

  const updated: number = await tx.$executeRaw`
    UPDATE item AS i
    SET
      kind = t.kind::"ItemKind",
      model_ref = t.model_ref,
      model_kind = t.model_kind::"ModelKind",
      animated = t.animated,
      updated_at = now()
    FROM unnest(
      ${aliases}::text[],
      ${kinds}::text[],
      ${modelRefs}::text[],
      ${modelKinds}::text[],
      ${animated}::boolean[]
    ) AS t(alias, kind, model_ref, model_kind, animated)
    JOIN item_alias a ON a.alias = t.alias
    WHERE i.id = a.item_id
      AND i.nexo_id IS NULL
      AND (i.kind, i.model_ref, i.model_kind, i.animated)
        IS DISTINCT FROM
        (t.kind::"ItemKind", t.model_ref, t.model_kind::"ModelKind", t.animated)
  `;

  const created: number = await tx.$executeRaw`
    WITH input AS (
      SELECT uuidv7() AS id, t.*
      FROM unnest(
        ${aliases}::text[],
        ${kinds}::text[],
        ${modelRefs}::text[],
        ${modelKinds}::text[],
        ${animated}::boolean[]
      ) AS t(alias, kind, model_ref, model_kind, animated)
      WHERE NOT EXISTS (SELECT 1 FROM item_alias a WHERE a.alias = t.alias)
    ),
    new_items AS (
      INSERT INTO item (id, kind, model_ref, model_kind, animated, updated_at)
      SELECT id, kind::"ItemKind", model_ref, model_kind::"ModelKind", animated, now()
      FROM input
    )
    INSERT INTO item_alias (alias, item_id)
    SELECT alias, id FROM input
  `;

  return { created, updated };
};
