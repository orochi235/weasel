import { inferredNodeRouting } from './defaultNodeRouting';
import { KIT_SHAPE_KINDS } from './useBuiltinShapeTools';
import type { NodePropertiesEntry } from 'core/scene/NodeProperties';
import type { ToolPrefGroup, ToolPrefNumberUnit } from 'tools/prefs';

const RAD_TO_DEG = 180 / Math.PI;

/** Radians-stored / degrees-shown conversion for `pose.rotation` leaves.
 *  Display rounds to 0.1° so a canonical radian value doesn't render as
 *  a 15-digit float. */
export const rotationDegreesUnit: ToolPrefNumberUnit = {
  toDisplay: (rad) => Math.round(rad * RAD_TO_DEG * 10) / 10,
  fromDisplay: (deg) => deg / RAD_TO_DEG,
  suffix: '°',
};

/** Build the standard shape schema — Layout (pose box + rotation) +
 *  Appearance (fill / stroke / stroke width), optionally a Text group.
 *  Matches the kit's builtin-shape data template
 *  (`{ path, fill, stroke?, strokeWidth?, text? }`, `useBuiltinShapeTools`). */
function shapeSchema(opts: { text?: boolean } = {}): ToolPrefGroup {
  return {
    name: 'Properties',
    children: {
      layout: {
        name: 'Layout',
        children: {
          'pose.x': { kind: 'number', name: 'X', description: 'Left edge, world units.', default: 0, pair: 'Position' },
          'pose.y': { kind: 'number', name: 'Y', description: 'Top edge, world units.', default: 0, pair: 'Position' },
          'pose.width': { kind: 'number', name: 'W', description: 'Width, world units.', default: 0, min: 0, pair: 'Size' },
          'pose.height': { kind: 'number', name: 'H', description: 'Height, world units.', default: 0, min: 0, pair: 'Size' },
          'pose.rotation': { kind: 'number', name: 'Rotation', description: 'Rotation about the box center.', default: 0, step: 1, unit: rotationDegreesUnit },
        },
      },
      appearance: {
        name: 'Appearance',
        children: {
          'data.fill': { kind: 'color', name: 'Fill', description: 'Fill color.', default: '#000000ff', alpha: true },
          'data.stroke': { kind: 'color', name: 'Stroke', description: 'Stroke color.', default: '#000000ff', alpha: true },
          'data.strokeWidth': { kind: 'number', name: 'Stroke width', description: 'Stroke width, world units.', default: 0, min: 0, step: 0.5 },
        },
      },
      ...(opts.text
        ? {
            text: {
              name: 'Text',
              children: {
                'data.text': { kind: 'string', name: 'Text', description: 'Text content.', default: '' },
              },
            },
          }
        : {}),
    },
  };
}

/**
 * Lazily builds `target` on first real use and forwards every array
 * operation to it via `Proxy`.
 *
 * `useBuiltinShapeTools.tsx` imports the package's own barrel
 * (`@weasel-js/core`), so any module that both (a) is reachable from the
 * barrel's export graph and (b) eagerly reads `KIT_SHAPE_KINDS` at
 * module-evaluation time can observe an *incomplete* module during a
 * circular re-entry (e.g. a test that imports `defaultNodeRouting.ts`
 * directly, which imports `useBuiltinShapeTools.tsx`, which imports the
 * barrel, which imports this module — before `useBuiltinShapeTools.tsx`
 * has finished assigning `KIT_SHAPE_KINDS`). Deferring construction
 * until first access sidesteps that window entirely; by the time any
 * consumer actually reads the array, module loading has settled.
 */
function lazyArray<T>(build: () => readonly T[]): readonly T[] {
  let built: readonly T[] | undefined;
  const resolve = (): readonly T[] => (built ??= build());
  return new Proxy([] as T[], {
    get(_target, prop, receiver) {
      return Reflect.get(resolve(), prop, receiver);
    },
    has(_target, prop) {
      return Reflect.has(resolve(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(resolve(), prop);
    },
  }) as readonly T[];
}

/**
 * Default properties-trait entries covering the kit's built-in shape
 * kinds (`KIT_SHAPE_KINDS`) — the sibling of `defaultNodeRouting`. Every
 * kind gets the standard box schema; `text` adds a Text group. In
 * lockstep with `KIT_SHAPE_KINDS` by construction (derived via `.map`).
 */
export const defaultNodeProperties: readonly NodePropertiesEntry[] = lazyArray(() =>
  KIT_SHAPE_KINDS.map((name) => ({
    name,
    schema: shapeSchema({ text: name === 'text' }),
  })),
);

/**
 * Properties-trait entries for the *inferred* routing kinds
 * (`inferredNodeRouting`: `text` / `path` / `image`) — the vocabulary
 * consumers produce when they don't tag `data.kind` (e.g. WeaselDraw).
 * In lockstep with `inferredNodeRouting` by construction.
 */
export const inferredNodeProperties: readonly NodePropertiesEntry[] = lazyArray(() =>
  inferredNodeRouting.map((e) => ({
    name: e.name,
    schema: shapeSchema({ text: e.name === 'text' }),
  })),
);
