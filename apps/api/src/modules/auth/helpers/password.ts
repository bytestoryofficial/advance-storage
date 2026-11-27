import { hash, verify, type Options } from '@node-rs/argon2';

import { logger } from '../../../lib/logger.js';

// ============================================ CONSTANTS ============================================

/**
 * OWASP minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
 */
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} satisfies Options;

// ============================================ PUBLIC API ============================================

/** Hashes a password with Argon2id. The result includes the salt and parameters. */
export const hashPassword = (password: string): Promise<string> => hash(password, ARGON2_OPTIONS);

/**
 * Checks a password against a stored hash in constant time.
 * Can't crash on bad data.
 */
export const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> => {
  try {
    return await verify(passwordHash, password);
  } catch (error: unknown) {
    logger.error({ err: error }, 'stored password hash is malformed');
    return false;
  }
};

/** Hash of a random password, so "unknown user" costs the same as "wrong password". */
const dummyHash: Promise<string> = hashPassword(crypto.randomUUID());

/**
 * Burns the same time as a real verify when the username doesn't exist.
 *
 * Without it, "unknown user" answers in ~1 ms and "wrong password" in ~50 ms,
 * so an attacker could find out which clan members have accounts just by timing logins.
 */
export const verifyAgainstDummy = async (password: string): Promise<false> => {
  await verifyPassword(await dummyHash, password);
  return false;
};
