import { HTTPException } from 'hono/http-exception';
import { createMiddleware } from 'hono/factory';
import type { Next } from 'hono';

import type { IAuthUser, IValidSession } from '../modules/auth/auth.types.js';
import { validateSession } from '../modules/auth/session.service.js';
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from '../modules/auth/helpers/cookie.js';

import { type IAppEnv } from '../types.js';

// ============================================ TYPES ============================================

interface IAuthedEnv {
  Variables: { user: IAuthUser };
}

// ============================================ MIDDLEWARE ============================================

/**
 * Reads the session cookie and sets `user` / `sessionId` on the context.
 *
 * - No cookie: anonymous, no database query.
 * - Invalid or expired cookie: anonymous, and the cookie is cleared.
 * - Renewed session: the cookie is re-sent with the new expiry.
 */
export const loadSession = createMiddleware<IAppEnv>(async (context, next: Next) => {
  context.set('user', null);
  context.set('sessionId', null);

  const token: string | undefined = readSessionCookie(context);

  if (token) {
    const session: IValidSession | null = await validateSession(token);

    if (session) {
      context.set('user', session.user);
      context.set('sessionId', session.sessionId);

      if (session.renewed) setSessionCookie(context, token, session.expiresAt);
    } else clearSessionCookie(context);
  }

  await next();
});

/** 401 unless logged in; 403 unless the user has one of `roles` (if given). */
const requireAuth = (...roles: IAuthUser['role'][]) =>
  createMiddleware<IAuthedEnv>(async (context, next: Next) => {
    const user = context.get('user') as IAuthUser | null;

    if (!user) throw new HTTPException(401, { message: 'Login required' });
    if (roles.length > 0 && !roles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    await next();
  });

export const requireUser = requireAuth();
export const requireAdmin = requireAuth('admin');
