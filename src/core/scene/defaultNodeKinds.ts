import { KIT_SHAPE_KINDS } from '../../canvas/SceneCanvas/useBuiltinShapeTools';
import type { NodeKind } from './nodeKindRegistry';

/**
 * Default routing-facet classifiers covering the kit's built-in shape
 * tools (`KIT_SHAPE_KINDS`). The routing facet's default values
 * happen to mirror the shape facet's by name; the two facets remain
 * independent — a consumer can register routing kinds that have no
 * matching shape painter (e.g. `'group'`, `'sticky-note'`).
 *
 * Consumers using the kit's standard data shape spread
 * `defaultNodeKinds` into their `<SceneCanvas kinds={...}>` prop;
 * consumers with a custom data shape register their own classifiers.
 *
 * Kept in lockstep with `KIT_SHAPE_KINDS` via the barrel parity test
 * in `src/index.barrel.test.ts`.
 */
export const defaultNodeKinds: readonly NodeKind[] = KIT_SHAPE_KINDS.map(
  (name) => ({
    name,
    matches: (data) =>
      typeof data === 'object' &&
      data !== null &&
      (data as { kind?: unknown }).kind === name,
  }),
);
