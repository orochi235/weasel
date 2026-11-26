// Three effect libraries' param descriptions, ported to `ParamShape` from their own shapes as read on
// 2026-11-25: magicsmoke `src/tuning.ts`, agnew `packages/agnew/src/blocks.ts`, beamos
// `packages/beamos/src/kinds/sparkle.ts`. Each sits beside the converter its lab wrote by hand.
import type { ParamNumber, ParamShape } from '@weasel-js/prefs-schema';
import { AUTO } from './auto';
import { f } from './builder';
import type { ConfigEntry } from './types';

const from: ParamNumber = {
  kind: 'number',
  label: 'Starts at intensity',
  min: 0,
  max: 1,
  step: 0.01,
  description: 'Off below this fault intensity; one-shots ignore it.',
};
const multiplier = (label: string, max = 3): ParamNumber => ({
  kind: 'number',
  label,
  min: 0,
  max,
  step: 0.05,
});

/** magicsmoke: labeled groups of numbers, with the defaults kept apart. */
export const MAGICSMOKE = {
  blow: {
    kind: 'group',
    label: 'Blow',
    params: {
      shudder: { kind: 'number', label: 'Shudder px at climax', min: 0, max: 60, step: 1 },
      showers: { kind: 'number', label: 'Showers at climax', min: 0, max: 8, step: 1 },
      surge: { kind: 'number', label: 'Discharge rate × at climax', min: 1, max: 10, step: 0.5 },
    },
  },
  sparks: {
    kind: 'group',
    label: 'Sparks',
    params: {
      from,
      count: multiplier('Count ×'),
      size: multiplier('Size ×'),
    },
  },
} as const satisfies ParamShape;

export const MAGICSMOKE_DEFAULTS = {
  blow: { shudder: 24, showers: 3, surge: 4 },
  sparks: { from: 0, count: 1, size: 1 },
};

/** magicsmoke's `lab/tuning/schema.ts` `controlsFor`, as written. */
export function magicsmokeByHand(): Record<string, ConfigEntry> {
  const shape: Record<string, ConfigEntry> = {};
  for (const [group, { label, params }] of Object.entries(MAGICSMOKE)) {
    const leaves: Record<string, ConfigEntry> = {};
    for (const [key, spec] of Object.entries(params) as [string, ParamNumber][]) {
      const fallback = (MAGICSMOKE_DEFAULTS as Record<string, Record<string, number>>)[group]?.[
        key
      ];
      let leaf = f
        .number(fallback ?? (spec.min as number))
        .range(spec.min as number, spec.max as number)
        .step(spec.step as number)
        .label(spec.label as string);
      if (spec.description) leaf = leaf.describe(spec.description);
      leaves[key] = leaf;
    }
    shape[group] = f.group(leaves).label(label);
  }
  return shape;
}

/** agnew: a block kind's params, numbers that may be auto, a choice and a flag. */
export const AGNEW = {
  axis: { kind: 'enum', label: 'Axis', default: 'y', options: ['x', 'y', 'z'] },
  R: {
    kind: 'number',
    label: 'Major radius',
    default: 0.72,
    min: 0.1,
    max: 2,
    step: 0.01,
    auto: { on: true },
  },
  twist: { kind: 'number', label: 'Twist', default: 0, min: -180, max: 180, step: 1, suffix: '°' },
  capped: { kind: 'boolean', label: 'Capped', default: true },
} as const satisfies ParamShape;

/** agnew's `apps/lab/src/schema.ts` `paramSchema` for these params, with `startAuto` as `.initial(AUTO)`. */
export function agnewByHand(): Record<string, ConfigEntry> {
  return {
    axis: f.enum('y', ['x', 'y', 'z']).label('Axis'),
    R: f.number(0.72).range(0.1, 2).step(0.01).label('Major radius').auto().initial(AUTO),
    twist: f.number(0).range(-180, 180).step(1).label('Twist').suffix('°'),
    capped: f.boolean(true).label('Capped'),
  };
}

/** beamos: a kind's params by name, numbers and a color. */
export const BEAMOS = {
  count: { kind: 'number', label: 'Cells', default: 48, min: 6, max: 160, step: 1 },
  density: { kind: 'number', label: 'Density', default: 0.5, min: 0, max: 1, step: 0.01 },
  tint: { kind: 'color', label: 'Tint', default: '#ffd27a' },
} as const satisfies ParamShape;

/** beamos' `apps/lab/src/Inspector.tsx` `controlsFor`, as written. */
export function beamosByHand(): Record<string, ConfigEntry> {
  return {
    count: f.number(48).range(6, 160).step(1).label('Cells'),
    density: f.number(0.5).range(0, 1).step(0.01).label('Density'),
    tint: f.color('#ffd27a').label('Tint'),
  };
}
