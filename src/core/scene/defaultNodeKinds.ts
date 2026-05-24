import { KIT_SHAPE_KINDS } from '../../canvas/SceneCanvas/useBuiltinShapeTools';
import type { NodeKind } from './nodeKindRegistry';

function isObj(d: unknown): d is Record<string, unknown> {
  return typeof d === 'object' && d !== null;
}

/**
 * Default routing-facet classifiers covering the kit's built-in shape
 * tools (`KIT_SHAPE_KINDS`). Each entry matches `data.kind === '<name>'`
 * — the convention demos use when they explicitly tag scene data with a
 * routing-kind string.
 *
 * Consumers using the kit's standard data shape spread
 * `defaultNodeKinds` into their `<SceneCanvas kinds={...}>` prop;
 * consumers whose data carries no `kind` field but follows the kit's
 * common shapes (`{ path }`, `{ text }`, `{ image }`) should prefer
 * `inferredNodeKinds` below, which SceneCanvas applies automatically
 * when `kinds` is unset.
 *
 * Kept in lockstep with `KIT_SHAPE_KINDS` via the barrel parity test
 * in `src/index.barrel.test.ts`.
 */
export const defaultNodeKinds: readonly NodeKind[] = KIT_SHAPE_KINDS.map(
  (name) => ({
    name,
    matches: (data) =>
      isObj(data) &&
      (data as { kind?: unknown }).kind === name,
  }),
);

/**
 * Shape-inferred routing-facet classifiers used when a consumer doesn't
 * pass `kinds` to `<SceneCanvas>`. Produces semantic kinds based on
 * data-shape hints rather than an explicit `data.kind` tag:
 *
 *   - `'text'` when `data.text` is a string (`text-edit` mode entry)
 *   - `'path'` when `data.path` is present  (`path-edit` mode entry)
 *   - `'image'` when `data.image` is present
 *
 * Order matters: `'text'` beats `'path'` so an SVG-imported text node
 * carrying a fallback `path` routes to text-edit. Consumers wanting
 * different precedence pass their own `kinds` array.
 *
 * Without this default the `kindOf` classifier is undefined when
 * `kinds` is unset and every hit comes back as `kind: 'unknown'`,
 * silently breaking `Hit.kind`-based routing (e.g. modality's
 * `dispatchDoubleClickEntry`).
 */
export const inferredNodeKinds: readonly NodeKind[] = [
  { name: 'text', matches: (d) => isObj(d) && typeof d.text === 'string' },
  { name: 'path', matches: (d) => isObj(d) && d.path != null },
  { name: 'image', matches: (d) => isObj(d) && d.image != null },
];
