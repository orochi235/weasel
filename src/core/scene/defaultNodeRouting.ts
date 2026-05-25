import { KIT_SHAPE_KINDS } from '../../canvas/SceneCanvas/useBuiltinShapeTools';
import type { NodeRoutingEntry } from './NodeRouting';

/**
 * Default routing-trait classifiers covering the kit's built-in shape
 * tools (`KIT_SHAPE_KINDS`). The routing trait's default values
 * happen to mirror the shape trait's by name; the two traits remain
 * independent — a consumer can register routing kinds that have no
 * matching shape painter (e.g. `'group'`, `'sticky-note'`).
 *
 * Consumers using the kit's standard data shape spread
 * `defaultNodeRouting` into their `<SceneCanvas routing={...}>` prop;
 * consumers with a custom data shape register their own classifiers.
 *
 * Kept in lockstep with `KIT_SHAPE_KINDS` via the barrel parity test
 * in `src/index.barrel.test.ts`.
 */
export const defaultNodeRouting: readonly NodeRoutingEntry[] = KIT_SHAPE_KINDS.map(
  (name) => ({
    name,
    matches: (data) =>
      typeof data === 'object' &&
      data !== null &&
      (data as { kind?: unknown }).kind === name,
  }),
);
