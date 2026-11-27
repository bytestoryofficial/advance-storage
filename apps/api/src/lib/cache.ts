import { logger } from './logger.js';
import { redis } from './redis.js';

// ============================================ CONSTANTS ============================================

export const KEY_PREFIX: string = 'as:';

/** Up to +10 % random TTL, so keys written together don't all expire in the same second. */
const TTL_JITTER_RATIO: number = 0.1;

// ============================================ STATE ============================================

/** Loads in progress, per key. Concurrent misses on one key share one `loader()` call. */
const inFlight: Map<string, Promise<unknown>> = new Map();

// ============================================ HELPERS ============================================

const withJitter = (ttlSeconds: number): number =>
  ttlSeconds + Math.floor(Math.random() * ttlSeconds * TTL_JITTER_RATIO);

const readCache = async <T>(fullKey: string): Promise<T | undefined> => {
  if (!redis.isReady) return undefined;

  try {
    const hit: string | null = await redis.get(fullKey);
    return hit === null ? undefined : (JSON.parse(hit) as T);
  } catch (error: unknown) {
    logger.warn({ err: error, key: fullKey }, 'cache read failed');
    return undefined;
  }
};

const writeCache = (fullKey: string, value: unknown, ttlSeconds: number): void => {
  if (!redis.isReady) return;

  void redis
    .set(fullKey, JSON.stringify(value), {
      expiration: { type: 'EX', value: withJitter(ttlSeconds) },
    })
    .catch((error: unknown): void => {
      logger.warn({ err: error, key: fullKey }, 'cache write failed');
    });
};

// ============================================ PUBLIC API ============================================

/**
 * Cache-aside: returns the cached value, or calls `loader`, caches its result and returns it.
 *
 * - Redis is optional: any Redis error counts as a miss, so the API keeps working from Postgres.
 * - Concurrent misses on the same key share one `loader()` call (no stampede on expiry).
 * - `null` / `undefined` results are not cached (a 404 must not be remembered for `ttlSeconds`).
 * - The value goes through JSON: only cache plain DTOs (no `Date`, `Map`, class instances).
 */
export const cached = async <T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const fullKey: string = `${KEY_PREFIX}${key}`;

  const hit: T | undefined = await readCache<T>(fullKey);

  if (hit !== undefined) {
    logger.debug({ key: fullKey }, 'cache hit');
    return hit;
  }

  const pending = inFlight.get(fullKey) as Promise<T> | undefined;

  if (pending) return pending;

  const load: Promise<T> = (async (): Promise<T> => {
    logger.debug({ key: fullKey }, 'cache miss');
    const value: T = await loader();
    const shouldCache: boolean = value !== null && value !== undefined;

    if (shouldCache) writeCache(fullKey, value, ttlSeconds);

    return value;
  })().finally((): void => {
    inFlight.delete(fullKey);
  });

  inFlight.set(fullKey, load);
  return load;
};

/** Deletes cached entries, e.g. after an admin edits an item. Errors are logged, not thrown. */
export const invalidate = async (...keys: string[]): Promise<void> => {
  if (!redis.isReady || keys.length === 0) return;

  try {
    const keysToDelete: string[] = keys.map((key: string): string => `${KEY_PREFIX}${key}`);
    await redis.del(keysToDelete);
  } catch (error: unknown) {
    logger.warn({ err: error, keys }, 'cache invalidation failed');
  }
};
