import { prisma } from '@advance-storage/db';

import type { INewSession } from './auth.types.js';

import { generateToken, hashToken } from './helpers/token.js';

// ============================================ CONSTANTS ============================================

/** A session lives 30 days */
const SESSION_TTL_MS: number = 30 * 24 * 60 * 60 * 1000;

// ============================================ PUBLIC API ============================================

/** Creates a session and returns the token for the cookie. Only its hash is stored. */
export const createSession = async (userId: string): Promise<INewSession> => {
  const token: string = generateToken();
  const expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  return { token, expiresAt };
};

/** Deletes the session behind a token. Unknown tokens are ignored: logout must always succeed. */
export const revokeSession = async (token: string): Promise<void> => {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
};
