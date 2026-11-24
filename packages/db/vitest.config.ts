import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

Object.assign(process.env, loadEnv('test', process.cwd(), ''));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['prisma/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
});
