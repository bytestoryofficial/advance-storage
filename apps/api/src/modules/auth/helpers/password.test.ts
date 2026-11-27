import { describe, expect, it } from 'vitest';

import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('produces an Argon2id hash with the OWASP parameters', async () => {
    const passwordHash: string = await hashPassword('correct horse battery staple');

    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('uses a new random salt every time', async () => {
    const first: string = await hashPassword('same-password');
    const second: string = await hashPassword('same-password');

    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const passwordHash: string = await hashPassword('correct horse battery staple');

    expect(await verifyPassword(passwordHash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(passwordHash, 'correct horse battery stapler')).toBe(false);
  });

  it('treats a malformed stored hash as a mismatch instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('dummy verification always fails', async () => {
    expect(await verifyAgainstDummy('anything')).toBe(false);
  });
});
