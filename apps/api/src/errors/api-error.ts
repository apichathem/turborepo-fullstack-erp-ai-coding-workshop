import { Logger } from '@nestjs/common';
import { type ApiErrorCategory, type ApiErrorData, ApiErrorDataSchema } from '@erp/contracts';
import { ORPCError } from '@orpc/server';

const logger = new Logger('ApiError');

const CODE_BY_CATEGORY = { CORRECT_INPUT: 'BAD_REQUEST', RETRY: 'CONFLICT' } as const;

/**
 * Reject a request with the API's error envelope. Handlers use this for every business rejection:
 * `throw apiError('RETRY', 'STOCK_CHANGED', 'Stock changed, try again')`.
 * `code` is a stable machine code, `message` a short English sentence (the web app shows Thai).
 */
export function apiError(category: ApiErrorCategory, code: string, message: string) {
  return new ORPCError(CODE_BY_CATEGORY[category], {
    message,
    data: { category, code } satisfies ApiErrorData,
  });
}

/** Turn whatever a handler threw into an `ORPCError` that is safe to send to the client. */
function toApiError(error: unknown): ORPCError<string, unknown> {
  if (error instanceof ORPCError) {
    // Already in the envelope.
    if (ApiErrorDataSchema.safeParse(error.data).success) return error;
    // Input validation by the contract. Drop the zod issues, they echo the input back.
    if (error.code === 'BAD_REQUEST') {
      return apiError('CORRECT_INPUT', 'VALIDATION_FAILED', 'Invalid input');
    }
    // Rejections a handler raised on purpose (401, 403, 404, ...) already have a safe message.
    if (error.status < 500) return error;
  }

  // Prisma P2034: a transaction lost a write conflict or deadlock. The same request can succeed.
  if (error instanceof Error && (error as { code?: unknown }).code === 'P2034') {
    return apiError('RETRY', 'CONFLICT', 'Conflicting update, try again');
  }

  // Unexpected: the details stay in the server log, the client gets a fixed message.
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  return new ORPCError('INTERNAL_SERVER_ERROR', {
    message: 'Internal server error',
    data: { category: 'RETRY', code: 'INTERNAL_ERROR' } satisfies ApiErrorData,
  });
}

/**
 * Wraps every procedure call (input validation included).
 * Register it once: `ORPCModule.forRoot({ interceptors: [apiErrorInterceptor] })`.
 */
export async function apiErrorInterceptor<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next();
  } catch (error) {
    throw toApiError(error);
  }
}
