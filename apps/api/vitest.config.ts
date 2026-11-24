import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

Object.assign(process.env, loadEnv('test', process.cwd(), ''));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One shared test database: files must not run in parallel and wipe each other's data
    fileParallelism: false,
  },
});
