import { describe, expect, it } from 'vitest';

import { createApp } from './create-app.js';

import { createMemoryRateLimitStore, type IRateLimitStore } from './lib/rate-limit.js';
import type { IErrorBody } from './lib/http-error.js';

const API_PATH: string = '/api/v1/collections';
const ALLOWED_ORIGIN: string = 'http://localhost:3000';

const downStore: IRateLimitStore = { hit: (): Promise<null> => Promise.resolve(null) };

describe('secure headers', () => {
  it('adds the standard security headers to every response', async () => {
    const res: Response = await createApp().request('/health/live');

    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('CORS', () => {
  it('allows the frontend origin in a preflight request', async () => {
    const res: Response = await createApp().request(API_PATH, {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'GET' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('does not allow any other origin', async () => {
    const res: Response = await createApp().request(API_PATH, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' },
    });

    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });
});

describe('body limit', () => {
  it('rejects a body over 100 kb with 413 before any route runs', async () => {
    const res: Response = await createApp().request(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'x'.repeat(200 * 1024) }),
    });

    expect(res.status).toBe(413);

    const body = (await res.json()) as IErrorBody;
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('rate limit', () => {
  it('allows `limit` requests, then answers 429 with Retry-After', async () => {
    const app = createApp({ rateLimitStore: createMemoryRateLimitStore(), rateLimitMax: 3 });

    for (let i = 0; i < 3; i++) {
      const ok: Response = await app.request(API_PATH);
      expect(ok.status).toBe(200);
    }

    const blocked: Response = await app.request(API_PATH);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('ratelimit-remaining')).toBe('0');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

    const body = (await blocked.json()) as IErrorBody;
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('keeps CORS headers on a 429, so the browser sees the real error', async () => {
    const app = createApp({ rateLimitStore: createMemoryRateLimitStore(), rateLimitMax: 1 });
    const headers: Record<string, string> = { Origin: ALLOWED_ORIGIN };

    await app.request(API_PATH, { headers });
    const blocked: Response = await app.request(API_PATH, { headers });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
  });

  it('never throttles health checks', async () => {
    const app = createApp({ rateLimitStore: createMemoryRateLimitStore(), rateLimitMax: 1 });

    for (let i = 0; i < 5; i++) {
      const res: Response = await app.request('/health/live');
      expect(res.status).toBe(200);
    }
  });

  it('fails open: when the store is down, requests pass', async () => {
    const app = createApp({ rateLimitStore: downStore, rateLimitMax: 1 });

    for (let i = 0; i < 3; i++) {
      const res: Response = await app.request(API_PATH);
      expect(res.status).toBe(200);
    }
  });
});
