import { serve, type ServerType } from '@hono/node-server';
import { setTimeout as sleep } from 'node:timers/promises';
import type { AddressInfo } from 'node:net';

import { prisma } from '@advance-storage/db';

import { createApp } from './create-app.js';

import { logger } from './lib/logger.js';

import { env } from './env.js';
import { isShuttingDown, markShuttingDown } from './lib/shutdown-state.js';

// ============================================ CONSTANTS ============================================

/** Time for the load balancer to see `/ready` = 503 and stop sending traffic. */
const DRAIN_DELAY_MS: number = 3_000;

/** Max time to finish in-flight requests on shutdown. Docker kills the process after 10 s. */
const SHUTDOWN_TIMEOUT_MS: number = 8_000;

// ============================================ SERVER ============================================

const server: ServerType = serve(
  { fetch: createApp().fetch, port: env.PORT },
  (info: AddressInfo): void => {
    logger.info({ port: info.port, env: env.NODE_ENV }, 'API is listening');
  },
);

/** Stops accepting connections and resolves when in-flight requests finish. */
const closeServer = (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    server.close((error?: Error): void => (error ? reject(error) : resolve()));
  });
};

// ============================================ SHUTDOWN LOGIC ============================================

/**
 * Graceful shutdown:
 * 1. `/ready` starts returning 503 -> 2. wait for the load balancer ->
 * 3. finish in-flight requests -> 4. close DB connections -> 5. exit.
 * A timer forces exit if this takes longer than {@link SHUTDOWN_TIMEOUT_MS}.
 */

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (isShuttingDown()) return;

  markShuttingDown();
  logger.info({ signal }, 'shutting down');

  setTimeout((): void => {
    logger.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  let exitCode: number = 0;

  try {
    await sleep(DRAIN_DELAY_MS);
    await closeServer();
  } catch (error: unknown) {
    logger.error({ err: error }, 'failed to close HTTP server');
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }

  logger.info('shutdown completed!');
  process.exit(exitCode);
};

// ============================================ PROCESS HANDLERS ============================================

process.on('SIGINT', (signal: NodeJS.Signals): void => void shutdown(signal));
process.on('SIGTERM', (signal: NodeJS.Signals): void => void shutdown(signal));

process.on('unhandledRejection', (reason: unknown): void => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error: Error): void => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});
