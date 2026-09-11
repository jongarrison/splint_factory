import assert from 'node:assert/strict';
import test from 'node:test';
import infinityFlexDefinition from './infinity-flex/definition.json';
import relativeMotionDefinition from './relative-motion/definition.json';
import type { DesignDefinition } from './types';
import { validateDesignInput } from './validate-input';

const relativeMotionInput = {
  relative_motion_data: {
    is_right_hand: true,
    finger_data: [
      {
        finger_abbr: 'if',
        is_included: true,
        is_anchor_finger: true,
        p1_mid_circ: 60,
        p1_length: 45,
        pip_neighbor_fwd_offset: 0,
        is_slitted: false,
      },
      {
        finger_abbr: 'mf',
        is_included: true,
        is_anchor_finger: false,
        p1_mid_circ: 62,
        p1_length: 47,
        pip_neighbor_fwd_offset: 2,
        is_slitted: false,
      },
      {
        finger_abbr: 'rf',
        is_included: true,
        is_anchor_finger: true,
        p1_mid_circ: 58,
        p1_length: 44,
        pip_neighbor_fwd_offset: -1,
        is_slitted: true,
      },
      {
        finger_abbr: 'sf',
        is_included: false,
        is_anchor_finger: false,
        p1_mid_circ: null,
        p1_length: null,
        pip_neighbor_fwd_offset: null,
        is_slitted: null,
      },
    ],
    all_splint_finger_circ: 180,
    relative_elevation_angle: 20,
    longitudinal_band_width_mm: 10,
    enable_support_path_ramp: true,
  },
};

test('accepts a valid RelativeMotion payload', () => {
  assert.doesNotThrow(() => validateDesignInput(
    relativeMotionDefinition as DesignDefinition,
    relativeMotionInput,
  ));
});

test('rejects RelativeMotion elevation outside -50 to 50', () => {
  const input = structuredClone(relativeMotionInput);
  input.relative_motion_data.relative_elevation_angle = 51;

  assert.throws(
    () => validateDesignInput(relativeMotionDefinition as DesignDefinition, input),
    /must be <= 50/,
  );
});

test('rejects unexpected nested RelativeMotion parameters', () => {
  const input = structuredClone(relativeMotionInput) as typeof relativeMotionInput & {
    relative_motion_data: typeof relativeMotionInput.relative_motion_data & { unexpected: boolean };
  };
  input.relative_motion_data.unexpected = true;

  assert.throws(
    () => validateDesignInput(relativeMotionDefinition as DesignDefinition, input),
    /unexpected parameter unexpected/,
  );
});

test('rejects unexpected parameters for flat definitions', () => {
  assert.throws(
    () => validateDesignInput(infinityFlexDefinition as DesignDefinition, {
      root_circumference_mm: 60,
      mid_circumference_mm: 60,
      tip_circumference_mm: 55,
      inter_phalanx_distance_mm: 40,
      flexion_degrees: 10,
      include_slit: false,
      unexpected: true,
    }),
    /Unexpected parameter: unexpected/,
  );
});