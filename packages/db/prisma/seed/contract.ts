import { z } from 'zod';

// ============================== SCHEMAS ======================================
/**
 * Item kinds as stored in the seed file.
 * The values match the `ItemKind` enum in the Prisma schema one to one.
 */
export const itemKindSchema = z.enum([
  'weapon',
  'tool',
  'armor',
  'shield',
  'key',
  'case_container',
  'cosmetic',
  'decor',
  'event_item',
  'trophy',
  'other',
]);

/**
 * Model kinds as written by the pack extractor.
 * '3d' is also the database value of `ModelKind.three_d` (see `@map("3d")`).
 */
export const modelKindSchema = z.enum(['3d', 'flat', 'unknown']);

/** An item that exists in the resource pack and has a stable `nexoId`. */
export const packItemSchema = z.object({
  nexoId: z.string().min(1),
  nameRu: z.string(),
  kind: itemKindSchema,
  customModelData: z.array(z.string().min(1)),
  modelRef: z.string().nullable(),
  modelKind: modelKindSchema,
  animated: z.boolean(),
});

/** An old item that is reachable only through a `base_item#custom_model_data` alias. */
export const legacyItemSchema = z.object({
  alias: z.string().min(1),
  baseItem: z.string().min(1),
  modelRef: z.string().nullable(),
  modelKind: modelKindSchema,
  animated: z.boolean(),
});

/** One case (or set) from the pack, with its items in display order. */
export const seedCaseSchema = z.object({
  slug: z.string().min(1),
  nameRu: z.string(),
  items: z.array(packItemSchema),
});

/**
 * The whole `advance-storage.seed.json` file.
 * Unknown keys (e.g. `textures`, `part`) are stripped: the seed only takes what the schema stores.
 */
export const seedFileSchema = z.object({
  cases: z.array(seedCaseSchema),
  nonCaseItems: z.array(packItemSchema),
  legacyItems: z.array(legacyItemSchema),
});

export type TItemKind = z.infer<typeof itemKindSchema>;
export type IPackItem = z.infer<typeof packItemSchema>;
export type ILegacyItem = z.infer<typeof legacyItemSchema>;
export type ISeedCase = z.infer<typeof seedCaseSchema>;
export type ISeedFile = z.infer<typeof seedFileSchema>;
