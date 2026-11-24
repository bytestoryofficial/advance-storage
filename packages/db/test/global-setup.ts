import { execSync } from 'node:child_process';

/** Applies all migrations to the test database once before the test run. */
export default function setup(): void {
  const url: string = process.env.DATABASE_URL ?? '';

  if (!url.includes('_test')) {
    throw new Error(`Refusing to run tests: DATABASE_URL is not a test database (${url})`);
  }

  execSync('prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
