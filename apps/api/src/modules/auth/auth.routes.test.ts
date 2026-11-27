import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@advance-storage/db';

import { createMemoryRateLimitStore, type IRateLimitStore } from '../../lib/rate-limit.js';
import type { IErrorBody } from '../../lib/http-error.js';

import { generateToken, hashToken } from './helpers/token.js';
import { hashPassword } from './helpers/password.js';
import { createApp } from '../../create-app.js';

import type { IAuthUser } from './auth.types.js';

import { resetDb } from '../../../test/reset-db.js';

// ============================================ HELPERS ============================================

const BASE: string = '/api/v1/auth';
const PASSWORD: string = 'correct horse battery staple';
const DAY_MS: number = 24 * 60 * 60 * 1000;

const downStore: IRateLimitStore = { hit: (): Promise<null> => Promise.resolve(null) };

const createUser = async (username: string = 'Maks_Pro'): Promise<string> => {
  const user = await prisma.user.create({
    data: {
      username,
      usernameKey: username.toLowerCase(),
      passwordHash: await hashPassword(PASSWORD),
    },
  });

  return user.id;
};

const getMe = (app: ReturnType<typeof createApp>, cookie?: string) =>
  app.request(`${BASE}/me`, { headers: cookie ? { Cookie: cookie } : {} });

/** Inserts a session directly, with any expiry; returns the cookie for it. */
const sessionCookieExpiringIn = async (userId: string, ms: number): Promise<string> => {
  const token: string = generateToken();
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + ms) },
  });

  return `session=${token}`;
};

/** A fresh app per test, so rate-limit counters never leak between tests. */
const newApp = (options: Parameters<typeof createApp>[0] = {}) =>
  createApp({ rateLimitStore: createMemoryRateLimitStore(), ...options });

const post = (app: ReturnType<typeof createApp>, path: string, body?: unknown, cookie?: string) =>
  app.request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** `session=abc; Path=/; HttpOnly…` → `session=abc` */
const cookieFrom = (res: Response): string =>
  (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

// ============================================ TESTS ============================================

beforeEach(resetDb);

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('logs in, returns the user without the hash, and sets a safe session cookie', async () => {
    await createUser();
    const res: Response = await post(newApp(), '/login', {
      username: 'Maks_Pro',
      password: PASSWORD,
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { user: IAuthUser };
    expect(body.user).toMatchObject({ username: 'Maks_Pro', role: 'member' });
    expect(body.user).not.toHaveProperty('passwordHash');

    const setCookie: string = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^session=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');

    expect(await prisma.session.count()).toBe(1);
  });

  it('treats the username as case-insensitive', async () => {
    await createUser();
    const res: Response = await post(newApp(), '/login', {
      username: 'maks_pro',
      password: PASSWORD,
    });

    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401 and creates no session', async () => {
    await createUser();
    const res: Response = await post(newApp(), '/login', {
      username: 'Maks_Pro',
      password: 'nope',
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it('gives an unknown user exactly the same answer as a wrong password', async () => {
    await createUser();
    const app = newApp();

    const wrongPassword = (await (
      await post(app, '/login', { username: 'Maks_Pro', password: 'nope' })
    ).json()) as IErrorBody;
    const unknownUser = (await (
      await post(app, '/login', { username: 'Nobody', password: 'nope' })
    ).json()) as IErrorBody;

    expect(unknownUser.error.code).toBe(wrongPassword.error.code);
    expect(unknownUser.error.message).toBe(wrongPassword.error.message);
  });

  it('blocks after too many attempts with 429', async () => {
    await createUser();
    const app = newApp({ loginRateLimitMax: 2 });

    await post(app, '/login', { username: 'Maks_Pro', password: 'nope' });
    await post(app, '/login', { username: 'Maks_Pro', password: 'nope' });
    const third: Response = await post(app, '/login', { username: 'Maks_Pro', password: PASSWORD });

    expect(third.status).toBe(429);
  });

  it('fails closed: login is unavailable when the limiter store is down, the catalog is not', async () => {
    await createUser();
    const app = createApp({ rateLimitStore: downStore });

    const login: Response = await post(app, '/login', { username: 'Maks_Pro', password: PASSWORD });
    expect(login.status).toBe(503);

    const catalog: Response = await app.request('/api/v1/collections');
    expect(catalog.status).toBe(200);
  });
});

describe('POST /auth/logout', () => {
  it('deletes the session and clears the cookie', async () => {
    await createUser();
    const app = newApp();

    const login: Response = await post(app, '/login', { username: 'Maks_Pro', password: PASSWORD });
    const logout: Response = await post(app, '/logout', undefined, cookieFrom(login));

    expect(logout.status).toBe(204);
    expect(await prisma.session.count()).toBe(0);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('succeeds without a cookie, so logging out twice is never an error', async () => {
    const res: Response = await post(newApp(), '/logout');
    expect(res.status).toBe(204);
  });
});

describe('GET /auth/me', () => {
  it('answers 401 without a session cookie', async () => {
    const res: Response = await getMe(newApp());
    expect(res.status).toBe(401);
  });

  it('returns the logged-in user, and does not touch the cookie of a fresh session', async () => {
    await createUser();
    const app = newApp();

    const login: Response = await post(app, '/login', { username: 'Maks_Pro', password: PASSWORD });
    const me: Response = await getMe(app, cookieFrom(login));

    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: IAuthUser }).user.username).toBe('Maks_Pro');
    expect(me.headers.get('set-cookie')).toBeNull();
  });

  it('answers 401 after logout, even with the old cookie', async () => {
    await createUser();
    const app = newApp();

    const cookie: string = cookieFrom(
      await post(app, '/login', { username: 'Maks_Pro', password: PASSWORD }),
    );
    await post(app, '/logout', undefined, cookie);

    const me: Response = await getMe(app, cookie);
    expect(me.status).toBe(401);
  });

  it('rejects an expired session, deletes it and clears the cookie', async () => {
    const userId: string = await createUser();
    const cookie: string = await sessionCookieExpiringIn(userId, -DAY_MS);

    const me: Response = await getMe(newApp(), cookie);

    expect(me.status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
    expect(me.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('extends a session with less than 15 days left and re-sends the cookie', async () => {
    const userId: string = await createUser();
    const cookie: string = await sessionCookieExpiringIn(userId, 5 * DAY_MS);

    const me: Response = await getMe(newApp(), cookie);

    expect(me.status).toBe(200);
    expect(me.headers.get('set-cookie')).toMatch(/^session=.+Expires=/);

    const session = await prisma.session.findFirstOrThrow();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
  });

  it('ignores a cookie with an unknown token and clears it', async () => {
    const me: Response = await getMe(newApp(), `session=${generateToken()}`);

    expect(me.status).toBe(401);
    expect(me.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
