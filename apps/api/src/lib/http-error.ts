import { STATUS_CODES } from 'node:http';

import type { IValidationIssue } from './validate.js';

// ============================================ TYPES ============================================

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
export const codeFor = (status: number): string => {
  return (STATUS_CODES[status] ?? 'Error').toUpperCase().replaceAll(' ', '_');
};

/** Builds an {@link IErrorBody}. */
export const errorBody = (
  code: string,
  message: string,
  requestId: string,
  details?: IValidationIssue[],
): IErrorBody => {
  return { error: { code, message, requestId, ...(details && { details }) } };
};
