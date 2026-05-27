/**
 * Reusable validation summary banner. Renders nothing when there are no errors.
 * Place inside the form card (typically near the top) and pass the ref returned
 * by `useFormValidation` so the hook can scroll to it on failed submit.
 */
import type { FieldErrors } from '@/lib/formValidation';

interface ValidationSummaryProps {
  errors: FieldErrors;
  summaryRef: React.RefObject<HTMLDivElement | null>;
  message?: string;
  testId?: string;
}

export default function ValidationSummary({
  errors,
  summaryRef,
  message = 'Please fix the highlighted fields below.',
  testId,
}: ValidationSummaryProps) {
  const count = Object.keys(errors).length;
  // Always render the wrapper so the ref is stable for scroll targeting,
  // but hide visually when there are no errors.
  if (count === 0) {
    return <div ref={summaryRef} aria-hidden="true" />;
  }
  return (
    <div
      ref={summaryRef}
      className="alert-error"
      role="alert"
      aria-live="polite"
      data-testid={testId}
    >
      {message}
    </div>
  );
}
