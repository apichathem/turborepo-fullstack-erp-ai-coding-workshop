import { type ApiErrorCategory, ApiErrorDataSchema } from '@erp/contracts';
import { ORPCError } from '@orpc/client';
import { cn } from '@/lib/utils';

// What the user should do, in Thai. Keyed by the category of the API's error envelope.
const MESSAGES: Record<ApiErrorCategory, string> = {
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

/** Shows an API error as an actionable Thai message. Renders nothing when there is no error. */
export function ApiErrorMessage({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;

  return (
    <p role="alert" className={cn('text-sm text-destructive', className)}>
      {MESSAGES[apiErrorCategory(error)]}
    </p>
  );
}
