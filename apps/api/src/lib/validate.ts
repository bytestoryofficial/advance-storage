import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { z } from 'zod';

import { errorBody, type IErrorBody } from './http-error.js';

// ============================================ TYPES ============================================

export interface IValidationIssue {
  path: string;
  message: string;
}

// ============================================ PUBLIC API ============================================

/**
 * `zValidator` with our error format.
 *
 * On invalid input it answers `400` with an {@link IErrorBody}:
 * - `message`: every problem in one readable string (for logs and toasts);
 * - `details`: one {@link IValidationIssue} per field (for form errors on the frontend).
 *
 * Return type is inferred on purpose: it carries the schema type to `c.req.valid(target)`.
 *
 * @param target - Which part of the request to validate: `query`, `param`, `json`…
 * @param schema - Zod schema; the handler then reads typed data via `c.req.valid(target)`.
 */
export const validate = <TTarget extends keyof ValidationTargets, TSchema extends z.ZodType>(
  target: TTarget,
  schema: TSchema,
) => {
  return zValidator(target, schema, (result, context) => {
    if (result.success) return;

    const requestId = context.get('requestId');
    const details: IValidationIssue[] = result.error.issues.map(
      (issue: z.core.$ZodIssue): IValidationIssue => ({
        path: issue.path.join('.'),
        message: issue.message,
      }),
    );

    const body: IErrorBody = errorBody(
      'VALIDATION_ERROR',
      z.prettifyError(result.error),
      requestId,
      details,
    );

    return context.json(body, 400);
  });
};
