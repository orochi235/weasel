import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import { isTextData } from '@weasel-js/text';

function isObj(d: unknown): d is Record<string, unknown> {
  return typeof d === 'object' && d !== null;
}

/** Routes a container node as `'group'`, whatever its data holds. `inferredNodeRouting` leads
 *  with it; spread it ahead of `defaultNodeRouting`, which is the shape-kind table alone. */
export const groupNodeRouting: NodeRoutingEntry = {
  name: 'group',
  matches: (_data, node) => node?.kind === 'group',
};

/**
 * Routing classifiers for the kit's built-in shape kinds
 * (`KIT_SHAPE_KINDS`): each entry matches `data.kind === '<name>'`. Routing
 * kinds and shape kinds are independent — `'group'` has no shape painter.
 *
 * Spread it into `<SceneCanvas routing={...}>` when scene data carries a
 * `kind` tag. Data with no `kind` that follows the kit's common shapes
 * (`{ path }`, `{ text }`, `{ image }`) wants `inferredNodeRouting`, which
 * SceneCanvas applies when `routing` is unset.
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
 * Routing classifiers used when a consumer doesn't pass `routing` to
 * `<SceneCanvas>`, keyed on the data's shape rather than a `data.kind` tag.
 *
 * Order matters: `'text'` beats `'path'` so an SVG-imported text node
 * carrying a fallback `path` routes to text-edit.
 */
export const inferredNodeRouting: readonly NodeRoutingEntry[] = [
  groupNodeRouting,
  { name: 'text', matches: isTextData },
  { name: 'path', matches: (d) => isObj(d) && d.path != null },
  { name: 'image', matches: (d) => isObj(d) && d.image != null },
];
