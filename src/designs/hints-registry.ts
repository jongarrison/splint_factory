// Client-safe: no fs or server-only imports.
// Maps design IDs to their hint evaluation functions.
// Add an entry here when a new design has hints.ts.
import type { HintsFn } from './types';
import { getHints as infinityFlexHints } from './infinity-flex/hints';

const hintsByDesignId: Record<string, HintsFn> = {
  'cmlljl3ha0001ju04s6szruyx': infinityFlexHints, // Infinity Flex
};

export function getDesignHintsFn(designId: string): HintsFn | undefined {
  return hintsByDesignId[designId];
}
