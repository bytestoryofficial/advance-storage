import { execSync } from 'node:child_process';

/** Applies all migrations to the test database once before the test run. */
export default function setup(): void {
  const url: string = process.env.DATABASE_URL ?? '';

  // Safety net: never run tests (which delete data) against a non-test database
  if (!url.includes('_test')) {
    throw new Error(`Refusing to run tests: DATABASE_URL is not a test database (${url})`);
  }

  execSync('pnpm --filter @advance-storage/db exec prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}
