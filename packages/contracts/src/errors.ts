import * as z from 'zod';

/**
 * What the user should do about a rejected request.
 * - `CORRECT_INPUT`: the request was wrong. Fix the data and send it again.
 * - `RETRY`: the request may be fine. Send the same thing again later.
 */
export const ApiErrorCategorySchema = z.enum(['CORRECT_INPUT', 'RETRY']);
export type ApiErrorCategory = z.infer<typeof ApiErrorCategorySchema>;

/**
 * The `data` of every error the API sends, next to the standard `code`, `status` and `message`.
 * `code` is a stable machine code such as `VALIDATION_FAILED` or `INTERNAL_ERROR`.
 * It never carries stack traces, database messages or other internals.
 */
export const ApiErrorDataSchema = z.object({
  category: ApiErrorCategorySchema,
  code: z.string().min(1),
});
export type ApiErrorData = z.infer<typeof ApiErrorDataSchema>;
