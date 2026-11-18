import type { Prisma } from '../../src/generated/prisma/client.js';

/** The client available inside `prisma.$transaction(async (tx) => …)`. */
export type TTx = Prisma.TransactionClient;
