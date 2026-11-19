import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.url(),
});

export type TEnv = z.infer<typeof envSchema>;

export const env: TEnv = envSchema.parse(process.env);
