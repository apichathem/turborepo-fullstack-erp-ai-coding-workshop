import { apiErrorCategory, API_ERROR_MESSAGES } from '@/lib/api-error-category';
import { cn } from '@/lib/utils';

/** Shows an API error as an actionable Thai message. Renders nothing when there is no error. */
export function ApiErrorMessage({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;

  return (
    <p role="alert" className={cn('text-sm text-destructive', className)}>
      {API_ERROR_MESSAGES[apiErrorCategory(error)]}
    </p>
  );
}
