import { KIT_SHAPE_KINDS } from '../../canvas/SceneCanvas/useBuiltinShapeTools';
import type { NodeKind } from './nodeKindRegistry';

/**
 * Default node-kind classifiers covering the kit's built-in shape tools
 * (`KIT_SHAPE_KINDS`).
 *
 * Each entry classifies nodes whose `data` carries a `{ kind: string }`
 * field matching the shape's name — the convention the kit's built-in
 * shape tools follow when minting new nodes. Consumers using that
 * convention spread `defaultNodeKinds` into their `<SceneCanvas kinds={...}>`
 * prop; consumers with a custom data shape register their own classifiers.
 *
 * Kept in lockstep with `KIT_SHAPE_KINDS` via the barrel parity test in
 * `src/index.barrel.test.ts`.
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
