import { STATUS_CODES } from 'node:http';

// ============================================ TYPES ============================================

export interface IErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
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
export const errorBody = (code: string, message: string, requestId: string): IErrorBody => {
  return { error: { code, message, requestId } };
};
