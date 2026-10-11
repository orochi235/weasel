import { isPrefLeaf, isPrefSection, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import type { PrefDrop, PrefDropMark } from '../Prefs';
import { isLoose } from './loose';
import { childrenOf, fitsUnder, isUnder, keyOf, keysOf, nodeAt, parentPath, pathOf, withinDepth, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';

/**
 * Where a drop on the live preview lands in the schema: `mark` is what the form says is under the pointer, `nodes`
 * are what is being dropped, and `paths` are where those already sit, none for a node not in the schema yet. Null
 * when the preview has nothing there to drop on, or the schema would not hold the nodes there, by kind or by `maxDepth`.
 */
export function previewTarget(
  schema: SchemaRoot, mark: PrefDropMark | null, nodes: readonly SchemaNode[], paths: readonly string[], maxDepth?: number,
): SchemaTarget | null {
  // A section root previews as a properties panel, which has no drop marks.
  if (mark === null || isPrefSection(schema)) return null;
  // Under a group root every key is one step of the value path.
  const at = mark.path === '' ? null : pathOf(mark.path.split('.'));
  const node = nodeAt(schema, at);
  if (!node) return null;
  const into = mark.where === 'into';
  if (!into && at === null) return null;
  const dest = into ? at : parentPath(at!);
  const host = nodeAt(schema, dest);
  const kids = host && !isPrefLeaf(host) ? childrenOf(host) : undefined;
  if (!host || !kids) return null;
  if (!nodes.every((n) => fitsUnder(host, n)) || !withinDepth(dest, nodes, maxDepth)) return null;
  // The root takes pages alone: anything else dropped there would be on none.
  if (dest === null && nodes.some(isLoose)) return null;
  if (dest !== null && paths.some((p) => dest === p || isUnder(dest, p))) return null;
  const keys = Object.keys(kids);
  return { parentPath: dest, index: into ? keys.length : keys.indexOf(keyOf(at!)) + (mark.where === 'after' ? 1 : 0) };
}

/**
 * The mark a drag of `nodes` makes of what the form found under the pointer. Only a group sits among the rail's
 * entries, so a leaf held over the edge of one goes into its group like one held over its middle.
 */
export function previewMark(mark: PrefDropMark | null, nodes: readonly SchemaNode[]): PrefDropMark | null {
  return mark?.rail && mark.where !== 'into' && nodes.some(isPrefLeaf) ? { ...mark, where: 'into' } : mark;
}

/** What the form draws for a drag of `nodes`, sitting at tree `paths`, that would land at `mark`. */
export function previewDrop(mark: Pick<PrefDrop, 'path' | 'where' | 'rail'>, nodes: readonly SchemaNode[], paths: readonly string[]): PrefDrop {
  return {
    ...mark,
    // Only what a group holds reaches here: `previewTarget` took the mark.
    nodes: nodes.filter((n): n is PrefLeaf | PrefGroup => !isPrefSection(n)),
    // Under a group root every key is one step of the value path.
    from: paths.map((p) => keysOf(p).join('.')),
  };
}

/**
 * What the form draws for a drag with nowhere to land: `nodes` as placeholders where they sit, at tree `paths`.
 * Null for nodes not in the schema yet, and under a section root, whose preview draws no drop.
 */
export function heldDrop(schema: SchemaRoot, nodes: readonly SchemaNode[], paths: readonly string[]): PrefDrop | null {
  if (paths.length === 0 || isPrefSection(schema)) return null;
  return previewDrop({ path: '', where: 'home' }, nodes, paths);
}

/**
 * Whether the form shows the dragged node where it would land, so no ghost of it is wanted beside the pointer.
 * A drop into a rail entry lands on a page that may not be the open one.
 */
export function drawsNode(drop: PrefDrop | null | undefined): boolean {
  return drop != null && drop.where !== 'home' && !(drop.rail === true && drop.where === 'into');
}

/** Whether two drops draw the same form. */
export function sameDrop(a: PrefDrop | null, b: PrefDrop | null): boolean {
  if (a === null || b === null) return a === b;
  return a.path === b.path && a.where === b.where && a.rail === b.rail
    && a.nodes.length === b.nodes.length && a.nodes.every((n, i) => n === b.nodes[i])
    && (a.from ?? []).join() === (b.from ?? []).join();
}

/** Whether a node not in the schema yet may be dropped under tree row `parentId`. */
export function treeTakesNew(schema: SchemaRoot, node: SchemaNode, parentId: string | null, maxDepth?: number): boolean {
  if (!withinDepth(parentId, [node], maxDepth)) return false;
  // Under a group root the top level holds the pages alone.
  if (!isPrefSection(schema) && parentId === null) return !isLoose(node);
  const host = nodeAt(schema, parentId);
  return !!host && !isPrefLeaf(host) && !!childrenOf(host) && fitsUnder(host, node);
}
