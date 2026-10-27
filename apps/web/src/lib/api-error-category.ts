import { type ApiErrorCategory, ApiErrorDataSchema } from '@erp/contracts';
import { ORPCError } from '@orpc/client';

// What the user should do, in Thai. Keyed by the category of the API's error envelope.
export const API_ERROR_MESSAGES: Record<ApiErrorCategory, string> = {
  CORRECT_INPUT: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและแก้ไขข้อมูลที่กรอก แล้วลองอีกครั้ง',
  RETRY: 'ระบบไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
};

/**
 * The category of an error from the typed client. Anything without the API's envelope
 * (network failure, proxy error page) is treated as `RETRY`: the request itself may be fine.
 */
export function apiErrorCategory(error: unknown): ApiErrorCategory {
  if (error instanceof ORPCError) {
    const data = ApiErrorDataSchema.safeParse(error.data);
    if (data.success) return data.data.category;
  }
  return 'RETRY';
}
