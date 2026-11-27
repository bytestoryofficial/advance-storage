import { createHash, randomBytes } from 'node:crypto';

// ============================================ CONSTANTS ============================================

const TOKEN_BYTES: number = 32;

// ============================================ PUBLIC API ============================================

/**
 * A new random token for a session cookie or an invite code.
 * Base64url: 43 chars, safe in cookies and URLs without encoding.
 */
export const generateToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

/**
 * SHA-256 of a token, as 64 lowercase hex chars (the format the DB CHECK constraints expect).
 *
 */
export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};
