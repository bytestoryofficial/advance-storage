/**
 * Error thrown when an SNBT (Stringified NBT) string cannot be parsed from dumps.
 *
 * @remarks
 * SNBT is Minecraft's text representation of NBT data, used in commands
 * and item components (e.g. `{display:{Name:'"Case"'},Count:1b}`).
 *
 * The {@link SnbtSyntaxError.offset | offset} points to the exact character
 * where parsing failed, so callers can highlight the error position
 * in the UI or include it in validation responses.
 *
 * @example
 * ```ts
 * try {
 *   parseSnbt(input);
 * } catch (error) {
 *   if (error instanceof SnbtSyntaxError) {
 *     console.error(error.message); // "Unexpected token '}' at offset 14"
 *     highlightInput(error.offset);
 *   }
 * }
 * ```
 *
 * @see https://minecraft.wiki/w/NBT_format#SNBT_format
 */

/** ================================================================================== */

export class SnbtSyntaxError extends Error {
  public readonly offset: number;

  constructor(message: string, offset: number) {
    super(`${message} at offset ${offset}`);
    this.name = 'SnbtSyntaxError';
    this.offset = offset;
  }
}

/** ================================================================================== */
