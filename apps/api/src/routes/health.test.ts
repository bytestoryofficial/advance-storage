import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@advance-storage/db';

import { createApp } from '../create-app.js';

import type { IErrorBody } from '../lib/http-error.js';

// `app.request()` calls the app in memory: no port, no real HTTP server
const app = createApp();

afterAll(async (): Promise<void> => {
  await prisma.$disconnect();
});

describe('health routes', () => {
  it('GET /health/live answers 200 and is never cached', async () => {
    const res: Response = await app.request('/health/live');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('GET /health/ready answers 200 "degraded" when Postgres is up but the cache is down', async () => {
    const res: Response = await app.request('/health/ready');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'degraded', db: 'up', cache: 'down' });
  });

  it('unknown route answers 404 in the shared error format', async () => {
    const res: Response = await app.request('/does-not-exist');
    expect(res.status).toBe(404);

    const body = (await res.json()) as IErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.requestId).toBe('string');
    expect(body.error.requestId).not.toBe('');
  });
});
