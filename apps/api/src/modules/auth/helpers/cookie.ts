import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';

import { env } from '../../../env.js';

// ============================================ CONSTANTS ============================================

const IS_PRODUCTION: boolean = env.NODE_ENV === 'production';

/**
 * `__Host-` prefix in production: the browser then enforces Secure, Path=/ and no Domain,
 * so no subdomain can overwrite the cookie. Plain name in dev, where there's no HTTPS.
 */
export const SESSION_COOKIE: string = IS_PRODUCTION ? '__Host-session' : 'session';

// ============================================ PUBLIC API ============================================

/**
 * - `httpOnly`: JavaScript can't read it, so an XSS bug can't steal the session.
 * - `sameSite: Lax`: not sent on cross-site POSTs, the main CSRF defense.
 * - `secure`: HTTPS only (in production).
 */
export const setSessionCookie = (context: Context, token: string, expiresAt: Date): void => {
  setCookie(context, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
    maxAge: 60 * 60 * 24 * 30,
  });
};

export const readSessionCookie = (context: Context): string | undefined => {
  return getCookie(context, SESSION_COOKIE);
};

export const clearSessionCookie = (context: Context): void => {
  deleteCookie(context, SESSION_COOKIE, { path: '/', secure: IS_PRODUCTION });
};
