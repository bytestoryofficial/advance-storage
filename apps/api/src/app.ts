import { Hono } from 'hono';

import { prisma } from '@advance-storage/db';

export const app: Hono = new Hono();

app.get('/health/live', (req) => req.json({ status: 'ok' }));

app.get('/health/ready', async (req) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return req.json({ status: 'ok', db: 'up' });
  } catch {
    return req.json({ status: 'error', db: 'down' }, 503);
  }
});
