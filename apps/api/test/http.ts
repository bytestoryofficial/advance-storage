import { createApp } from '../src/create-app.js';

// ============================================ TYPES ============================================

export interface IJsonResponse<T> {
  status: number;
  body: T;
}

// ============================================ HELPERS ============================================

/** One app for all tests: `app.request()` runs it in memory, no port or real server. */
const app = createApp();

/** GET a path and parse the JSON body as `T`. */
export const getJson = async <T>(path: string): Promise<IJsonResponse<T>> => {
  const res: Response = await app.request(path);
  return { status: res.status, body: (await res.json()) as T };
};
