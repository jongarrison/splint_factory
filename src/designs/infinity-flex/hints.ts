import type { DesignHint } from '../types';

// Hints for the Infinity Flex design — evaluated client-side on blur
export function getHints(values: Record<string, number | boolean | string>): DesignHint[] {
  const hints: DesignHint[] = [];

  const root = Number(values.root_circumference_mm);
  const mid = Number(values.mid_circumference_mm);

  // Warn when the proximal ring is too small to pass over the PIP joint without a slit
  if (root > 0 && mid > 0 && root < mid * 0.95) {
    hints.push({
      message: 'P1 circumference is notably smaller than PIP — the proximal ring may not pass over the joint. Consider enabling the slit.',
      targetParameter: 'include_slit',
      severity: 'warning',
    });
  }

  return hints;
}
