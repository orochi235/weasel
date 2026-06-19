import { KIT_SHAPE_KINDS } from './useBuiltinShapeTools';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';

function isObj(d: unknown): d is Record<string, unknown> {
  return typeof d === 'object' && d !== null;
}

/**
 * Default routing-trait classifiers covering the kit's built-in shape
 * tools (`KIT_SHAPE_KINDS`). Each entry matches `data.kind === '<name>'`
 * — the convention demos use when they explicitly tag scene data with a
 * routing-kind string. The routing trait's default values happen to
 * mirror the shape trait's by name; the two traits remain independent
 * — a consumer can register routing kinds that have no matching shape
 * painter (e.g. `'group'`, `'sticky-note'`).
 *
 * Lives in the canvas layer (next to the builtin shape tools it mirrors)
 * rather than `core/scene`: the generic routing machinery (`NodeRouting`)
 * is core, but this default *population* depends on the canvas-layer
 * `KIT_SHAPE_KINDS`, so `core` must not own it.
 *
 * Consumers using the kit's standard data shape spread
 * `defaultNodeRouting` into their `<SceneCanvas routing={...}>` prop;
 * consumers whose data carries no `kind` field but follows the kit's
 * common shapes (`{ path }`, `{ text }`, `{ image }`) should prefer
 * `inferredNodeRouting` below, which SceneCanvas applies automatically
 * when `routing` is unset.
 *
 * In lockstep with `KIT_SHAPE_KINDS` by construction (derived via `.map`).
 */
export const defaultNodeRouting: readonly NodeRoutingEntry[] = KIT_SHAPE_KINDS.map(
  (name) => ({
    name,
    matches: (data) =>
      isObj(data) &&
      (data as { kind?: unknown }).kind === name,
  }),
);

/**
 * Shape-inferred routing-trait classifiers used when a consumer doesn't
 * pass `routing` to `<SceneCanvas>`. Produces semantic kinds based on
 * data-shape hints rather than an explicit `data.kind` tag:
 *
 *   - `'text'` when `data.text` is a string (`text-edit` mode entry)
 *   - `'path'` when `data.path` is present  (`path-edit` mode entry)
 *   - `'image'` when `data.image` is present
 *
 * Order matters: `'text'` beats `'path'` so an SVG-imported text node
 * carrying a fallback `path` routes to text-edit. Consumers wanting
 * different precedence pass their own `routing` array.
 *
 * Without this default the `kindOf` classifier is undefined when
 * `routing` is unset and every hit comes back as `kind: 'unknown'`,
 * silently breaking `Hit.kind`-based routing (e.g. modality's
 * `dispatchDoubleClickEntry`).
 */
export const inferredNodeRouting: readonly NodeRoutingEntry[] = [
  { name: 'text', matches: (d) => isObj(d) && typeof d.text === 'string' },
  { name: 'path', matches: (d) => isObj(d) && d.path != null },
  { name: 'image', matches: (d) => isObj(d) && d.image != null },
];
