/**
 * Reusable client-side form validation primitives.
 *
 * Pattern: the page owns its validation rules (a function that returns
 * `Record<fieldKey, errorMessage>`). This hook owns the error state,
 * per-field clearing, and scroll-to-anchor on failed submit. Pair with
 * <ValidationSummary /> and the `input-field-error` CSS modifier for
 * consistent feedback across forms.
 *
 * Scroll behavior: by default we scroll to the summary element. Callers
 * may pass a `scrollTargetRef` (e.g. the top of the form card) to scroll
 * somewhere more prominent — useful on small screens where the summary
 * itself can be easy to miss.
 */
import { useCallback, useRef, useState } from 'react';

export type FieldErrors = Record<string, string>;

interface UseFormValidationOptions {
  /** Element to scroll into view on failed submit. Defaults to the summary element. */
  scrollTargetRef?: React.RefObject<HTMLElement | null>;
}

export interface UseFormValidationResult {
  errors: FieldErrors;
  hasErrors: boolean;
  setErrors: (next: FieldErrors) => void;
  clearError: (field: string) => void;
  clearAll: () => void;
  summaryRef: React.RefObject<HTMLDivElement | null>;
  scrollToErrors: () => void;
  /** Convenience: run a validator, set errors, scroll on failure. Returns true if valid. */
  runValidation: (validator: () => FieldErrors) => boolean;
}

export function useFormValidation(
  options: UseFormValidationOptions = {}
): UseFormValidationResult {
  const [errors, setErrorsState] = useState<FieldErrors>({});
  const summaryRef = useRef<HTMLDivElement | null>(null);

  const setErrors = useCallback((next: FieldErrors) => setErrorsState(next), []);

  // Remove a single field's error; no-op if not present (avoids needless renders).
  const clearError = useCallback((field: string) => {
    setErrorsState(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrorsState({}), []);

  // Prefer the caller-provided anchor (e.g. form card top) over the summary itself
  // so the entire alert is comfortably in view on small screens.
  const scrollToErrors = useCallback(() => {
    const target = options.scrollTargetRef?.current ?? summaryRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [options.scrollTargetRef]);

  const runValidation = useCallback((validator: () => FieldErrors): boolean => {
    const next = validator();
    setErrorsState(next);
    if (Object.keys(next).length > 0) {
      // Double rAF: first frame lets React commit + render the alert,
      // second frame guarantees layout is settled before we measure and scroll.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = options.scrollTargetRef?.current ?? summaryRef.current;
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      return false;
    }
    return true;
  }, [options.scrollTargetRef]);

  return {
    errors,
    hasErrors: Object.keys(errors).length > 0,
    setErrors,
    clearError,
    clearAll,
    summaryRef,
    scrollToErrors,
    runValidation,
  };
}

/** Returns the CSS class to append when a field has an error. */
export function fieldErrorClass(error?: string): string {
  return error ? 'input-field-error' : '';
}
