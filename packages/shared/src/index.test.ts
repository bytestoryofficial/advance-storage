import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FIXTURE_URL: URL = new URL(
  '../fixtures/dumps/case-item-waroflight-greatsword.snbt',
  import.meta.url,
);

describe('fixture url', (): void => {
  it('reads a dump file from fixture/dumps', (): void => {
    const content: string = readFileSync(FIXTURE_URL, 'utf8');

    expect(content.length).toBeGreaterThan(0);
    expect(content.trimStart().startsWith('{')).toBe(true);
  });
});
