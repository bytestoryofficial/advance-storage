import type { IPackItem } from '../contract';
import type { TTx } from '../types';

// =================================== TYPES =====================================

interface IItemIdRow {
  id: string;
  nexoId: string;
}

type TNexoIdToItemId = Map<string, string>;

// =================================== SQL API =====================================

/**
 * Bulk upserts pack items by `nexoId` and syncs their aliases.
 *
 * - Two round-trips for any batch size (`unnest` arrays, not one param per value).
 * - Duplicate `nexoId`s / aliases in the input: the last one wins.
 * - On conflict, `name_ru` is kept, so manual edits survive a re-import.
 * - An alias that already exists is moved to the new item.
 *
 * Must run inside a transaction so items and aliases commit together.
 *
 * @param tx - Prisma interactive transaction client.
 * @param items - Items parsed from a resource pack.
 * @returns Map of `nexoId` → item `id` for every upserted item.
 */
export const upsertPackItems = async (tx: TTx, items: IPackItem[]): Promise<TNexoIdToItemId> => {
  if (items.length === 0) return new Map();

  // ON CONFLICT cannot touch the same row twice in one statement
  const uniqueItems: IPackItem[] = [
    ...new Map(items.map((item: IPackItem): [string, IPackItem] => [item.nexoId, item])).values(),
  ];

  const rows: IItemIdRow[] = await tx.$queryRaw<IItemIdRow[]>`
    INSERT INTO item (nexo_id, name_ru, kind, model_ref, model_kind, animated, updated_at)
    SELECT
      t.nexo_id,
      NULLIF(t.name_ru, ''),
      t.kind::"ItemKind",
      t.model_ref,
      t.model_kind::"ModelKind",
      t.animated,
      now()
    FROM unnest(
      ${items.map((item: IPackItem): string => item.nexoId)}::text[],
      ${items.map((item: IPackItem): string => item.nameRu)}::text[],
      ${items.map((item: IPackItem): string => item.kind)}::text[],
      ${items.map((item: IPackItem): string | null => item.modelRef)}::text[],
      ${items.map((item: IPackItem): string => item.modelKind)}::text[],
      ${items.map((item: IPackItem): boolean => item.animated)}::boolean[]
    ) AS t(nexo_id, name_ru, kind, model_ref, model_kind, animated)
    ON CONFLICT (nexo_id) DO UPDATE SET
      kind       = EXCLUDED.kind,
      model_ref  = EXCLUDED.model_ref,
      model_kind = EXCLUDED.model_kind,
      animated   = EXCLUDED.animated,
      updated_at = now()
    RETURNING id, nexo_id AS "nexoId"
  `;

  const idByNexoId: TNexoIdToItemId = new Map(
    rows.map((row: IItemIdRow): [string, string] => [row.nexoId, row.id]),
  );

  // alias -> item id; a Map also removes duplicate aliases
  const itemIdByAlias: Map<string, string> = new Map();

  for (const item of uniqueItems) {
    const itemId: string | undefined = idByNexoId.get(item.nexoId);

    if (!itemId) continue;

    for (const alias of item.customModelData) itemIdByAlias.set(alias, itemId);
  }

  if (itemIdByAlias.size > 0) {
    await tx.$executeRaw`
    INSERT INTO item_alias (alias, item_id)
    SELECT a.alias, a.item_id
    FROM unnest(
        ${[...itemIdByAlias.keys()]}::text[],
        ${[...itemIdByAlias.values()]}::uuid[]
    ) AS a(alias, item_id)
    ON CONFLICT (alias) DO UPDATE SET item_id = EXCLUDED.item_id
    WHERE item_alias.item_id IS DISTINCT FROM EXCLUDED.item_id
  `;
  }

  return idByNexoId;
};
