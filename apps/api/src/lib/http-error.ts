// ============================================ CODES ============================================

/** Status -> code. Fixed on purpose: the frontend switches on these, so they must never change. */
const CODE_BY_STATUS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
} as const;

/** Every code the API can return. `VALIDATION_ERROR` is a 400 with per-field `details`. */
export type TErrorCode = (typeof CODE_BY_STATUS)[keyof typeof CODE_BY_STATUS] | 'VALIDATION_ERROR';

// ============================================ TYPES ============================================

/** One validation problem, e.g. `{ path: 'limit', message: 'Too big: expected <=100' }`. */
export interface IValidationIssue {
  path: string;
  message: string;
}

export interface IErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: IValidationIssue[];
  };
}

// ============================================ PUBLIC API ============================================

/**
 * Converts an HTTP status into a stable machine-readable code.
 *
 * @example codeFor(404) // "NOT_FOUND"
 */
export const codeFor = (status: number): TErrorCode =>
  CODE_BY_STATUS[status as keyof typeof CODE_BY_STATUS] ??
  (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

/** Builds an {@link IErrorBody}. */
export const errorBody = (
  code: string,
  message: string,
  requestId: string,
  details?: IValidationIssue[],
): IErrorBody => {
  return { error: { code, message, requestId, ...(details && { details }) } };
};
