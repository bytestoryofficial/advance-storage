/**
 * All token types produced by the SNBT lexer.
 *
 * @remarks
 * Structural tokens map 1:1 to a single character. Value tokens
 * (`string`, `bare`) carry their content in {@link IToken.value}.
 *
 * - `semicolon` appears only in typed array headers: `[B;1b,2b]`, `[I;1,2]`, `[L;1L,2L]`.
 * - `bare` is any unquoted word. The parser decides its final meaning
 *   (number with type suffix, boolean, or unquoted string/key).
 * - `eof` is always the last token, so the parser never reads past the input.
 *
 * @see https://minecraft.wiki/w/NBT_format#SNBT_format
 */

/** ================================ TYPES ======================================== */

export type TokenKind =
  | 'lbrace' // {
  | 'rbrace' // }
  | 'lbracket' // [
  | 'rbracket' // ]
  | 'colon' // :
  | 'comma' // ,
  | 'semicolon' // ;
  | 'string' // "..." or '...'
  | 'bare' // just word -> components, 0b, 1201.0f, true
  | 'eof'; // end line

export interface IToken {
  kind: TokenKind;
  value: string;
  offset: number;
}

/** ================================ CONSTANTS ======================================== */

/**
 * Single-character structural tokens, mapped to their {@link TokenKind}.
 *
 * @remarks
 * The lexer checks this map first before trying
 * to read a string or a bare word.
 */
export const PUNCTUATION: ReadonlyMap<string, TokenKind> = new Map<string, TokenKind>([
  ['{', 'lbrace'],
  ['}', 'rbrace'],
  ['[', 'lbracket'],
  [']', 'rbracket'],
  [':', 'colon'],
  [',', 'comma'],
  [';', 'semicolon'],
]);

/**
 * Fixed escape sequences inside quoted SNBT strings.
 * Key is the character after `\`, value is the decoded result.
 *
 * @remarks
 * Matches the escape set introduced in Java Edition 1.21.5.
 * Note that `\s` decodes to a regular space. This is Minecraft-specific
 * and does not exist in JSON or JavaScript.
 *
 * Both quote escapes (`\"` and `\'`) are accepted regardless of
 * which quote surrounds the string.
 *
 * @example
 * ```ts
 * SIMPLE_ESCAPES.get('n'); // '\n'
 * SIMPLE_ESCAPES.get('s'); // ' '
 * ```
 *
 * @see https://minecraft.wiki/w/NBT_format#SNBT_format
 */
export const SIMPLE_ESCAPES: ReadonlyMap<string, string> = new Map<string, string>([
  ['\\', '\\'],
  ['"', '"'],
  ["'", "'"],
  ['n', '\n'],
  ['s', ' '],
  ['t', '\t'],
  ['r', '\r'],
  ['b', '\b'],
  ['f', '\f'],
]);

/**
 * Number of hex digits required after each Unicode escape prefix.
 *
 * @remarks
 * Lengths are fixed: the lexer reads exactly N hex digits
 * and throws {@link SnbtSyntaxError} if there are fewer or any is invalid.
 *
 * - `\xXX` – 2 digits, code point `U+0000`–`U+00FF`
 * - `\uXXXX` – 4 digits, Basic Multilingual Plane
 * - `\UXXXXXXXX` – 8 digits, any code point up to `U+10FFFF`
 *
 * @example
 * ```ts
 * // '\u2605' -> '★'   (4 digits)
 * // '\U0001F60A' -> '😊' (8 digits)
 * ```
 */
export const HEX_ESCAPE_LENGTH: ReadonlyMap<string, number> = new Map<string, number>([
  ['x', 2],
  ['u', 4],
  ['U', 8],
]);

export const BARE_CHAR: RegExp = /[0-9A-Za-z_\-.+]/;
export const WHITESPACE: RegExp = /\s/;
export const HEX: RegExp = /^[0-9a-fA-F]+$/;
