import { SnbtSyntaxError } from './errors';
import {
  BARE_CHAR,
  HEX,
  HEX_ESCAPE_LENGTH,
  PUNCTUATION,
  SIMPLE_ESCAPES,
  WHITESPACE,
  type IToken,
  type TokenKind,
} from './token';

/** ================================ TYPES ======================================== */

interface IQuotedResult {
  value: string;
  end: number;
}

/** ================================ HELPERS ======================================== */

const MAX_CODE_POINT: number = 0x10ffff;

/**
 * Reads a quoted SNBT string starting at `start` and decodes its escapes.
 *
 * @remarks
 * The opening character (`"` or `'`) defines the closing one,
 * so `'say "hi"'` is valid without escaping the inner quotes.
 *
 * Supported escapes: see {@link SIMPLE_ESCAPES} and {@link HEX_ESCAPE_LENGTH}.
 *
 * @param source - Full SNBT input.
 * @param start - Index of the opening quote.
 * @returns Decoded content and the index after the closing quote.
 * @throws {@link SnbtSyntaxError} On an invalid or unsupported escape,
 * an out-of-range code point, or a missing closing quote.
 *
 * @example
 * ```ts
 * readQuoted(`{a:"x\\ny"}`, 3); // { value: 'x\ny', end: 9 }
 * ```
 */
const readQuoted = (source: string, start: number): IQuotedResult => {
  const quote: string = source.charAt(start);
  let index: number = start + 1;
  let value: string = '';

  while (index < source.length) {
    const sourceCharByIndex: string = source.charAt(index);

    if (sourceCharByIndex === quote) return { value, end: index + 1 };

    if (sourceCharByIndex !== '\\') {
      value += sourceCharByIndex;
      index++;
      continue;
    }
    // `\` is the last character — the string can never be closed.
    if (index + 1 >= source.length) break;

    const escape: string = source.charAt(index + 1);
    const simple: string | undefined = SIMPLE_ESCAPES.get(escape);

    if (simple !== undefined) {
      value += simple;
      index += 2;
      continue;
    }

    const hexLength: number | undefined = HEX_ESCAPE_LENGTH.get(escape);

    if (hexLength !== undefined) {
      const hex: string = source.slice(index + 2, index + 2 + hexLength);

      if (hex.length !== hexLength || !HEX.test(hex))
        throw new SnbtSyntaxError(`Invalid \\${escape} escape`, index);

      const codePoint: number = parseInt(hex, 16);

      // \U accepts 8 digits (up to 0xFFFFFFFF), but Unicode ends at 0x10FFFF.
      if (codePoint > MAX_CODE_POINT)
        throw new SnbtSyntaxError(`Code point out of range in \\${escape} escape`, index);

      value += String.fromCodePoint(parseInt(hex, 16));
      index += 2 + hexLength;
      continue;
    }

    throw new SnbtSyntaxError(`Unsupported escape '\\${escape}'`, index);
  }

  throw new SnbtSyntaxError('Unterminated string', start);
};

/** ================================ PUBLIC API ======================================== */

/**
 * Splits an SNBT string into tokens for the parser.
 *
 * @remarks
 * Single-pass lexer. Whitespace between tokens
 * is skipped, so pretty-printed SNBT is supported.
 *
 * The lexer only recognizes token boundaries; it does not validate
 * structure or interpret `bare` values (numbers, booleans, keys).
 * That is the parser's job.
 *
 * The result always ends with an `eof` token.
 *
 * @param source - Raw SNBT input, e.g. from a `/data get` command output.
 * @returns Token list ending with `eof`.
 * @throws {@link SnbtSyntaxError} On an unexpected character or an invalid string literal.
 *
 * @example
 * ```ts
 * tokenize('{Count:1b}');
 * // lbrace, bare "Count", colon, bare "1b", rbrace, eof
 * ```
 */
export const tokenize = (source: string): IToken[] => {
  const tokens: IToken[] = [];
  let index: number = 0;

  while (index < source.length) {
    const sourceCharByIndex: string = source.charAt(index);

    if (WHITESPACE.test(sourceCharByIndex)) {
      index++;
      continue;
    }

    const punctuation: TokenKind | undefined = PUNCTUATION.get(sourceCharByIndex);

    if (punctuation !== undefined) {
      tokens.push({ kind: punctuation, value: sourceCharByIndex, offset: index });
      index++;
      continue;
    }

    if (sourceCharByIndex === '"' || sourceCharByIndex === "'") {
      const quoted: IQuotedResult = readQuoted(source, index);
      tokens.push({ kind: 'string', value: quoted.value, offset: index });
      index = quoted.end;
      continue;
    }

    if (BARE_CHAR.test(sourceCharByIndex)) {
      const start: number = index;

      const bareTest: boolean = BARE_CHAR.test(source.charAt(index));

      while (index < source.length && bareTest) index++;

      tokens.push({ kind: 'bare', value: source.slice(start, index), offset: start });
      continue;
    }

    throw new SnbtSyntaxError(`Unexpected character "${sourceCharByIndex}"`, index);
  }

  tokens.push({ kind: 'eof', value: '', offset: source.length });
  return tokens;
};
