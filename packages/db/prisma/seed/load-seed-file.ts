import { readFileSync } from 'node:fs';

import { seedFileSchema, type ISeedFile } from './contract';

/**
 * Reads the catalog seed from disk and validates its shape.
 *
 * Validation happens before any database work, so a broken file
 * fails fast with a precise Zod error instead of half-written data.
 *
 * @param fileUrl - Location of `advance-storage.seed.json`.
 * @returns The parsed, type-safe seed.
 * @throws {z.ZodError} If the file does not match {@link seedFileSchema}.
 */
export function loadSeedFile(fileUrl: URL): ISeedFile {
  const raw: unknown = JSON.parse(readFileSync(fileUrl, 'utf8'));
  return seedFileSchema.parse(raw);
}
