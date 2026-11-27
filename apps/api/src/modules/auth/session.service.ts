import { prisma } from '@advance-storage/db';

import type { INewSession, IValidSession } from './auth.types.js';

import { generateToken, hashToken } from './helpers/token.js';

// ============================================ CONSTANTS ============================================

/** A session lives 30 days */
const SESSION_TTL_MS: number = 30 * 24 * 60 * 60 * 1000;

/**
 * Extend a session only when less than 15 days are left. Active users stay logged in
 * forever, at the cost of at most one database write per session every 15 days.
 */
const RENEW_WHEN_LEFT_MS: number = 15 * 24 * 60 * 60 * 1000;

// ============================================ PUBLIC API ============================================

/** Creates a session and returns the token for the cookie. Only its hash is stored. */
export const createSession = async (userId: string): Promise<INewSession> => {
  const token: string = generateToken();
  const expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  return { token, expiresAt };
};

/**
 * Looks up the session behind a cookie token.
 *
 * - Unknown token: `null`.
 * - Expired: deleted, then `null`.
 * - Less than 15 days left: extended to a full 30 days (`renewed: true`).
 */
export const validateSession = async (token: string): Promise<IValidSession | null> => {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, username: true, role: true } },
    },
  });

  if (!session) return null;

  const now: number = Date.now();

  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (session.expiresAt.getTime() - now > RENEW_WHEN_LEFT_MS) {
    return {
      sessionId: session.id,
      user: session.user,
      expiresAt: session.expiresAt,
      renewed: false,
    };
  }

  const expiresAt: Date = new Date(now + SESSION_TTL_MS);
  const { count } = await prisma.session.updateMany({
    where: { id: session.id },
    data: { expiresAt },
  });

  if (count == 0) return null;

  return { sessionId: session.id, user: session.user, expiresAt, renewed: true };
};

/** Deletes the session behind a token. Unknown tokens are ignored: logout must always succeed. */
export const revokeSession = async (token: string): Promise<void> => {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
};
