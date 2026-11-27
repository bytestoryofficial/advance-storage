import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';

import { checkCredentials } from './auth.service.js';
import { loginBodySchema } from './auth.schemas.js';

import { createSession, revokeSession } from './session.service.js';

import { clearSessionCookie, readSessionCookie, setSessionCookie } from './helpers/cookie.js';

import { validate } from '../../lib/validate.js';

import type { IAuthUser, INewSession } from './auth.types.js';
import { type IAppEnv } from '../../types.js';

/**
 * Login and logout. Login has its own strict rate limit (see `createApp`).
 *
 * CSRF, two layers:
 * 1. The session cookie is `SameSite=Lax`: browsers don't send it on cross-site POSTs.
 * 2. The `json` validator rejects any Content-Type except `application/json`. A cross-site
 *    form can only send form/text types; a cross-site `fetch` with JSON needs a CORS
 *    preflight, which only our frontend's origin passes.
 */
export const authRoutes = new Hono<IAppEnv>()
  .post('/login', validate('json', loginBodySchema), async (context) => {
    const { username, password } = context.req.valid('json');
    const user: IAuthUser | null = await checkCredentials(username, password);

    if (!user) throw new HTTPException(401, { message: 'Invalid username or password' });

    const previousToken: string | undefined = readSessionCookie(context);
    if (previousToken) await revokeSession(previousToken);

    const session: INewSession = await createSession(user.id);
    setSessionCookie(context, session.token, session.expiresAt);

    return context.json({ user });
  })
  .post('/logout', async (context) => {
    const token: string | undefined = readSessionCookie(context);
    clearSessionCookie(context);

    if (token) {
      try {
        await revokeSession(token);
      } catch (error: unknown) {
        context.get('logger').error({ err: error }, 'failed to revoke session on logout');
      }
    }

    return context.body(null, 204);
  });
