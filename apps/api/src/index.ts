import { serve, type ServerType } from '@hono/node-server';

import { prisma } from '@advance-storage/db';

import { app } from './app.js';
import { env } from './env.js';

const server: ServerType = serve({ fetch: app.fetch, port: env.PORT }, (info): void => {
  console.log(`API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  server.close((error?: Error): void => {
    void prisma.$disconnect().finally((): never => process.exit(error ? 1 : 0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
