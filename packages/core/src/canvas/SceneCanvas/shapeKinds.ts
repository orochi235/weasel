// Dependency-free: this module must have NO imports. `useBuiltinShapeTools.tsx`
// imports the package's own barrel (`@weasel-js/core`), so anything it exports
// is reachable only after the whole barrel finishes loading. Barrel-reachable
// constants that need `KIT_SHAPE_KINDS` at module-evaluation time — e.g.
// `defaultNodeRouting`/`defaultNodeProperties`, which build their arrays via
// eager `.map` — must import it from here instead, so they never enter the
// `useBuiltinShapeTools.tsx` <-> barrel cycle in the first place.

/**
 * Built-in shape tool ids handled by `useBuiltinShapeTools`. Each maps to a
 * kit tool hook + a default `create` that produces a leaf node compatible
 * with `PATH_PAINTER`.
 *
 * Runtime mirror in `KIT_SHAPE_KINDS` below — keep the two in sync. The
 * `src/index.barrel.test.ts` parity gate enforces that every member of this
 * union is present in the exported tuple.
 */
export type BuiltinShapeToolId =
  | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'pen' | 'pencil'
  | 'lasso' | 'text';

/** Runtime, iterable list of the shape-tool ids in `BuiltinShapeToolId`.
 *  Surfaced so consumers (e.g. the Bundle Inspector) can enumerate the
 *  builtin shape kinds without re-encoding the union. */
export const KIT_SHAPE_KINDS = [
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pen', 'pencil',
  'lasso', 'text',
] as const satisfies readonly BuiltinShapeToolId[];
