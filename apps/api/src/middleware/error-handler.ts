import type { HTTPResponseError, NotFoundHandler } from 'hono/types';
import { HTTPException } from 'hono/http-exception';
import type { Context, ErrorHandler } from 'hono';
import type { Logger } from 'pino';

import { codeFor, errorBody, type IErrorBody } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

import type { IAppEnv } from '../types.js';

/**
 * Turns every thrown error into an {@link IErrorBody} response.
 *
 * - `HTTPException` 4xx: thrown on purpose, its message is safe to show.
 *   Headers from its custom `res` (e.g. `WWW-Authenticate`) are kept.
 * - `HTTPException` 5xx and anything else: a server problem. Full details go
 *   to the log, the client gets a generic message.
 *
 * Relies on `requestId()` being the first middleware, so `requestId` is always set.
 */
export const onError: ErrorHandler<IAppEnv> = (
  error: Error | HTTPResponseError,
  context: Context<IAppEnv>,
): Response => {
  const requestId: string = context.get('requestId');

  if (error instanceof HTTPException && error.status < 500) {
    const headers: Headers | undefined = error.res?.headers;

    headers?.forEach((value: string, key: string): void => {
      if (key.toLocaleLowerCase() !== 'content-type') context.header(key, value);
    });

    const body: IErrorBody = errorBody(
      codeFor(error.status),
      error.message || 'Request failed',
      requestId,
    );

    return context.json(body, error.status);
  }

  const log: Logger = context.get('logger') ?? logger;
  log.error({ err: error }, 'unhandled error');

  const status = error instanceof HTTPException ? error.status : 500;
  const body: IErrorBody = errorBody(codeFor(status), 'Internal server error', requestId);

  return context.json(body, status);
};

/** Replaces Hono's plain-text 404 with an {@link IErrorBody}. */
export const notFound: NotFoundHandler<IAppEnv> = (context: Context<IAppEnv>) => {
  const requestId: string = context.get('requestId');
  const body = errorBody(
    'NOT_FOUND',
    `Route ${context.req.method} ${context.req.path} not found`,
    requestId,
  );

  return context.json(body, 404);
};
