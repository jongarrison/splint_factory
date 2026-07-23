'use client';

// Bespoke input form for the RelativeMotion splint. Unlike the flat scalar designs, this
// design needs a nested per-finger structure, so it renders its own fields and writes the
// whole job payload as { relative_motion_data: {...} } (the shape the geo processor reads
// via job_data["relative_motion_data"]). Minimal first pass: basic fields + light validation.

import { useEffect, useMemo, useState } from 'react';
import type { CustomFormProps } from '../types';

type FingerAbbr = 'if' | 'mf' | 'rf' | 'sf';

interface FingerModel {
  finger_abbr: FingerAbbr;
  is_included: boolean;
  is_anchor_finger: boolean;
  p1_mid_circ: string;
  p1_length: string;
  pip_neighbor_fwd_offset: string;
  is_slitted: boolean;
}

interface FormModel {
  is_right_hand: boolean;
  fingers: FingerModel[];
  all_splint_finger_circ: string;
  relative_elevation_angle: string;
  longitudinal_band_width_mm: string;
  enable_support_path_ramp: boolean;
}

const FINGER_LABELS: Record<FingerAbbr, string> = {
  if: 'Index',
  mf: 'Middle',
  rf: 'Ring',
  sf: 'Small',
};

const FINGER_ORDER: FingerAbbr[] = ['if', 'mf', 'rf', 'sf'];
const ELEVATION_MIN = -120;
const ELEVATION_MAX = 45;

// Default: index + ring anchor the middle finger; small finger excluded.
function defaultModel(): FormModel {
  const mk = (
    finger_abbr: FingerAbbr,
    is_included: boolean,
    is_anchor_finger: boolean,
  ): FingerModel => ({
    finger_abbr,
    is_included,
    is_anchor_finger,
    p1_mid_circ: '',
    p1_length: '',
    pip_neighbor_fwd_offset: '',
    is_slitted: false,
  });
  return {
    is_right_hand: true,
    fingers: [mk('if', true, true), mk('mf', true, false), mk('rf', true, true), mk('sf', false, false)],
    all_splint_finger_circ: '',
    relative_elevation_angle: '',
    longitudinal_band_width_mm: '10',
    enable_support_path_ramp: true,
  };
}

// Rebuild the form model from a previously-saved payload (template reuse).
function modelFromValue(value: Record<string, any> | undefined): FormModel | null {
  const rmd = value?.relative_motion_data;
  if (!rmd || !Array.isArray(rmd.finger_data)) return null;
  const byAbbr = new Map<string, any>(rmd.finger_data.map((f: any) => [f.finger_abbr, f]));
  const str = (v: any) => (v === null || v === undefined ? '' : String(v));
  return {
    is_right_hand: rmd.is_right_hand !== false,
    fingers: FINGER_ORDER.map((abbr) => {
      const f = byAbbr.get(abbr) || {};
      return {
        finger_abbr: abbr,
        is_included: !!f.is_included,
        is_anchor_finger: !!f.is_anchor_finger,
        p1_mid_circ: str(f.p1_mid_circ),
        p1_length: str(f.p1_length),
        pip_neighbor_fwd_offset: str(f.pip_neighbor_fwd_offset),
        is_slitted: !!f.is_slitted,
      };
    }),
    all_splint_finger_circ: str(rmd.all_splint_finger_circ),
    relative_elevation_angle: str(rmd.relative_elevation_angle),
    longitudinal_band_width_mm: str(rmd.longitudinal_band_width_mm) || '10',
    enable_support_path_ramp: rmd.enable_support_path_ramp !== false,
  };
}

function toNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

// Index of the first included finger; its forward offset is the 0 reference.
function firstIncludedIndex(fingers: FingerModel[]): number {
  return fingers.findIndex((f) => f.is_included);
}

// Assemble the nested payload the geo processor expects.
function buildRawData(model: FormModel) {
  const firstIdx = firstIncludedIndex(model.fingers);
  const finger_data = model.fingers.map((f, idx) => {
    if (!f.is_included) {
      return {
        finger_abbr: f.finger_abbr,
        is_included: false,
        is_anchor_finger: false,
        p1_mid_circ: null,
        p1_length: null,
        pip_neighbor_fwd_offset: null,
        is_slitted: null,
      };
    }
    return {
      finger_abbr: f.finger_abbr,
      is_included: true,
      is_anchor_finger: f.is_anchor_finger,
      p1_mid_circ: toNum(f.p1_mid_circ),
      p1_length: toNum(f.p1_length),
      // First included finger is the reference (always 0); only anchors may be slitted.
      pip_neighbor_fwd_offset: idx === firstIdx ? 0 : toNum(f.pip_neighbor_fwd_offset),
      is_slitted: f.is_anchor_finger ? f.is_slitted : false,
    };
  });
  return {
    is_right_hand: model.is_right_hand,
    finger_data,
    all_splint_finger_circ: toNum(model.all_splint_finger_circ),
    relative_elevation_angle: toNum(model.relative_elevation_angle),
    longitudinal_band_width_mm: toNum(model.longitudinal_band_width_mm),
    enable_support_path_ramp: model.enable_support_path_ramp,
  };
}

// Minimal first-pass validation; richer feedback is a follow-up.
function validate(model: FormModel): string[] {
  const errors: string[] = [];
  const fingers = model.fingers;
  const includedIdx = fingers.map((f, i) => (f.is_included ? i : -1)).filter((i) => i >= 0);

  if (includedIdx.length < 2) {
    errors.push('Include at least two fingers.');
  } else if (includedIdx[includedIdx.length - 1] - includedIdx[0] + 1 !== includedIdx.length) {
    errors.push('Included fingers must be contiguous (no gaps between them).');
  }

  const anchors = fingers.filter((f) => f.is_included && f.is_anchor_finger).length;
  const supported = fingers.filter((f) => f.is_included && !f.is_anchor_finger).length;
  if (anchors < 2) errors.push('At least two anchor fingers are required.');
  if (supported < 1) errors.push('At least one supported (non-anchor) finger is required.');

  const firstIdx = firstIncludedIndex(fingers);
  fingers.forEach((f, idx) => {
    if (!f.is_included) return;
    const label = FINGER_LABELS[f.finger_abbr];
    if ((toNum(f.p1_mid_circ) ?? 0) <= 0) errors.push(`${label}: P1 circumference must be > 0.`);
    if ((toNum(f.p1_length) ?? 0) <= 0) errors.push(`${label}: P1 length must be > 0.`);
    if (idx !== firstIdx && toNum(f.pip_neighbor_fwd_offset) === null) {
      errors.push(`${label}: forward offset is required.`);
    }
  });

  if ((toNum(model.all_splint_finger_circ) ?? 0) <= 0) {
    errors.push('All-fingers circumference must be > 0.');
  }
  const elev = toNum(model.relative_elevation_angle);
  if (elev === null || elev < ELEVATION_MIN || elev > ELEVATION_MAX) {
    errors.push(`Relative elevation angle must be between ${ELEVATION_MIN} and ${ELEVATION_MAX} degrees.`);
  }
  if ((toNum(model.longitudinal_band_width_mm) ?? 0) <= 0) {
    errors.push('Band width must be > 0.');
  }
  return errors;
}

export default function RelativeMotionForm({ value, onChange, onValidChange }: CustomFormProps) {
  const [model, setModel] = useState<FormModel>(() => modelFromValue(value) ?? defaultModel());

  // Push the assembled payload + validity up whenever the model changes.
  // onChange / onValidChange are stable state setters from the parent.
  useEffect(() => {
    onChange({ relative_motion_data: buildRawData(model) });
    onValidChange?.(validate(model).length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const errors = useMemo(() => validate(model), [model]);
  const firstIdx = useMemo(() => firstIncludedIndex(model.fingers), [model.fingers]);

  const updateFinger = (idx: number, patch: Partial<FingerModel>) => {
    setModel((prev) => ({
      ...prev,
      fingers: prev.fingers.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const setField = (patch: Partial<FormModel>) => setModel((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-6" data-testid="relative-motion-form">
      <div>
        <h3 className="text-lg font-medium text-primary mb-1">Relative Motion Details</h3>
        <p className="text-xs text-muted">
          Rings anchor two or more fingers and support the finger(s) between them. Included fingers
          must be contiguous, with at least two anchors and one supported finger.
        </p>
      </div>

      {/* Hand */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Hand</label>
        <div className="inline-flex gap-2">
          {[{ v: true, l: 'Right' }, { v: false, l: 'Left' }].map((opt) => (
            <button
              key={opt.l}
              type="button"
              onClick={() => setField({ is_right_hand: opt.v })}
              className={`${model.is_right_hand === opt.v ? 'btn-primary' : 'btn-neutral'} px-4 py-2 text-sm`}
              data-testid={`hand-${opt.l.toLowerCase()}`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Per-finger rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-2 pr-3 font-medium">Finger</th>
              <th className="py-2 px-3 font-medium">Include</th>
              <th className="py-2 px-3 font-medium">Role</th>
              <th className="py-2 px-3 font-medium">P1 Middle Circumference (mm)</th>
              <th className="py-2 px-3 font-medium">P1 Length (mm)</th>
              <th className="py-2 px-3 font-medium">PIP Fwd Offset (mm)</th>
              <th className="py-2 px-3 font-medium">Slit</th>
            </tr>
          </thead>
          <tbody>
            {model.fingers.map((f, idx) => {
              const disabled = !f.is_included;
              const isFirst = idx === firstIdx;
              return (
                <tr
                  key={f.finger_abbr}
                  className="border-t border-[var(--border)]"
                  data-testid={`finger-row-${f.finger_abbr}`}
                >
                  <td className={`py-2 pr-3 whitespace-nowrap ${disabled ? 'text-muted opacity-50' : 'text-secondary'}`}>
                    {FINGER_LABELS[f.finger_abbr]} <span className="text-muted">({f.finger_abbr})</span>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="checkbox"
                      checked={f.is_included}
                      onChange={(e) =>
                        updateFinger(idx, {
                          is_included: e.target.checked,
                          ...(e.target.checked ? {} : { is_anchor_finger: false, is_slitted: false }),
                        })
                      }
                      className="h-5 w-5 rounded border-[var(--border)] accent-[var(--accent-blue)]"
                      data-testid={`include-${f.finger_abbr}`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={f.is_anchor_finger ? 'anchor' : 'support'}
                      disabled={disabled}
                      onChange={(e) => {
                        const anchor = e.target.value === 'anchor';
                        updateFinger(idx, { is_anchor_finger: anchor, ...(anchor ? {} : { is_slitted: false }) });
                      }}
                      className="input-field py-1"
                      data-testid={`role-${f.finger_abbr}`}
                    >
                      <option value="anchor">Anchor</option>
                      <option value="support">Supported</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      value={f.p1_mid_circ}
                      onChange={(e) => updateFinger(idx, { p1_mid_circ: e.target.value })}
                      className="input-field py-1 w-24"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      value={f.p1_length}
                      onChange={(e) => updateFinger(idx, { p1_length: e.target.value })}
                      className="input-field py-1 w-24"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled || isFirst}
                      value={isFirst && f.is_included ? '0' : f.pip_neighbor_fwd_offset}
                      onChange={(e) => updateFinger(idx, { pip_neighbor_fwd_offset: e.target.value })}
                      className="input-field py-1 w-24"
                      title={
                        isFirst
                          ? 'Reference finger; offset is always 0'
                          : 'Offset vs the previous included finger (negative = more proximal)'
                      }
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="checkbox"
                      disabled={disabled || !f.is_anchor_finger}
                      checked={f.is_slitted}
                      onChange={(e) => updateFinger(idx, { is_slitted: e.target.checked })}
                      className="h-5 w-5 rounded border-[var(--border)] accent-[var(--accent-blue)]"
                      title="Sizing slit (anchor fingers only)"
                      data-testid={`slit-${f.finger_abbr}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Global measurements */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary">All-fingers circumference (mm)</label>
          <input
            type="text"
            inputMode="decimal"
            value={model.all_splint_finger_circ}
            onChange={(e) => setField({ all_splint_finger_circ: e.target.value })}
            className="mt-1 input-field"
            data-testid="all-splint-finger-circ"
          />
          <p className="mt-1 text-xs text-muted">Wrap around all included fingers in natural alignment.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary">Relative elevation angle (deg)</label>
          <input
            type="text"
            inputMode="decimal"
            value={model.relative_elevation_angle}
            onChange={(e) => setField({ relative_elevation_angle: e.target.value })}
            className="mt-1 input-field"
            data-testid="relative-elevation-angle"
          />
          <p className="mt-1 text-xs text-muted">
            Range: {ELEVATION_MIN} to {ELEVATION_MAX}. Positive lifts the supported finger dorsally.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary">Band Width (mm)</label>
          <input
            type="text"
            inputMode="decimal"
            value={model.longitudinal_band_width_mm}
            onChange={(e) => setField({ longitudinal_band_width_mm: e.target.value })}
            className="mt-1 input-field"
            data-testid="longitudinal-band-width"
          />
          <p className="mt-1 text-xs text-muted">Width of the splint band along the finger.</p>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={model.enable_support_path_ramp}
            onChange={(e) => setField({ enable_support_path_ramp: e.target.checked })}
            className="h-5 w-5 rounded border-[var(--border)] accent-[var(--accent-blue)]"
            data-testid="enable-support-path-ramp"
          />
          <div>
            <span className="text-sm font-medium text-secondary">Enable Finger Support Ramps</span>
            <p className="text-xs text-muted">
              Support Ramps distribute pressure more evenly on supported fingers.
            </p>
          </div>
        </label>
      </div>

      {errors.length > 0 && (
        <div className="alert-error text-sm" data-testid="relative-motion-errors">
          <p className="font-medium mb-1">Please resolve:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
