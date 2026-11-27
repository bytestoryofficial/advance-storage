import { z } from 'zod';

const LOGGER_ENUM = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LOG_LEVEL: LOGGER_ENUM.default('info'),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  CORS_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .transform((value: string): string => new URL(value).origin),
  /** Requests per IP per minute on `/api/*`. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  /** `true` only behind our Nginx, which overwrites `X-Real-IP` with the real client IP. */
  TRUST_PROXY: z.stringbool().default(false),
});

export type TEnv = z.infer<typeof envSchema>;

export const env: TEnv = envSchema.parse(process.env);
