import { describe, expect, it } from 'vitest';

import { generateToken, hashToken } from './token.js';

describe('tokens', () => {
  it('generates a 43-char base64url token', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats', () => {
    const tokens: Set<string> = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
  });

  it('hashes to the format the database CHECK constraint accepts', () => {
    expect(hashToken(generateToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes deterministically, so a cookie can be looked up by its hash', () => {
    const token: string = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
