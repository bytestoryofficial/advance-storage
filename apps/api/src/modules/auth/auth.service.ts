import { prisma } from '@advance-storage/db';

import type { IAuthUser } from './auth.types.js';

import { verifyAgainstDummy, verifyPassword } from './helpers/password.js';

// ============================================ CONSTANTS ============================================

const CREDENTIALS_SELECT = {
  id: true,
  username: true,
  role: true,
  passwordHash: true,
} as const;

// ============================================ PUBLIC API ============================================

/**
 * Checks a username and password.
 *
 * - The username is case-insensitive (looked up by `usernameKey`).
 * - Unknown user and wrong password take the same time and give the same `null`,
 *   so the response never reveals which clan members have an account.
 */
export const checkCredentials = async (
  username: string,
  password: string,
): Promise<IAuthUser | null> => {
  const user = await prisma.user.findUnique({
    where: { usernameKey: username.toLocaleLowerCase() },
    select: { ...CREDENTIALS_SELECT },
  });

  if (!user) {
    await verifyAgainstDummy(password);
    return null;
  }

  const isValid: boolean = await verifyPassword(user.passwordHash, password);

  if (!isValid) return null;

  return { id: user.id, username: user.username, role: user.role };
};
