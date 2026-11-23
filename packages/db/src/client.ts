import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

const connectionString: string | undefined = process.env.DATABASE_URL;
const CONNECTION_TIMEOUT = 5_000;
const STATEMENT_TIMEOUT = 15_000;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const adapter: PrismaPg = new PrismaPg({
  connectionString,
  connectionTimeoutMillis: CONNECTION_TIMEOUT,
  statement_timeout: STATEMENT_TIMEOUT,
});

export const prisma: PrismaClient = new PrismaClient({ adapter });
