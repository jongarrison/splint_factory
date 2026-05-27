// Test inputs for the "Infinity Flex" design as supplied by product.
// Keep in sync with InputParameter InputName values in the design schema.
//
// If the design schema's InputName fields change, this map must change too.
// The test fills inputs by id (which equals InputName), so a rename will
// surface as a missing-field error during the spec run.
export const INFINITY_FLEX = {
  designName: 'Infinity Flex',
  params: {
    root_circumference_mm: 69,
    mid_circumference_mm: 68,
    tip_circumference_mm: 60,
    inter_phalanx_distance_mm: 35,
    flexion_degrees: 10,
  },
} as const;

// Build a per-run job label that is (a) unique enough to avoid collisions
// across runs and (b) easy to recognize and clean up later. The Print Queue
// Label field caps at 20 characters, so keep this short.
// Format: e2e-hhmmss-rand4 (15 chars). Date is recoverable from createdAt.
export function makeJobLabel(prefix = 'e2e'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hhmmss = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${hhmmss}-${rand}`;
}
