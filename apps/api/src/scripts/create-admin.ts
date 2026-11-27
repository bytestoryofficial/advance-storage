import { prisma } from '@advance-storage/db';

import { hashPassword } from '../modules/auth/helpers/password.js';
import { generateToken } from '../modules/auth/helpers/token.js';

// Same rule as the `user_username_format_chk` constraint
const USERNAME_PATTERN: RegExp = /^[A-Za-z0-9_]{3,16}$/;

/**
 * Creates the first admin, outside the API: with invite-only registration,
 * there's no other way to get the first account.
 *
 * Usage: pnpm create-admin <MinecraftNickname>
 */
const main = async (): Promise<void> => {
  const username: string | undefined = process.argv[2];

  if (!username || !USERNAME_PATTERN.test(username))
    throw new Error('Usage: pnpm create-admin <MinecraftNick> (3–16 chars: letters, digits, _)');

  const usernameKey: string = username.toLowerCase();

  if (await prisma.user.findUnique({ where: { usernameKey } }))
    throw new Error(`User ${username} already exists`);

  const password: string = generateToken();

  await prisma.user.create({
    data: { username, usernameKey, passwordHash: await hashPassword(password), role: 'admin' },
  });

  console.log(`Admin ${username} created.`);
  console.log(`Password (shown once, save it in a password manager): ${password}`);
};

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
