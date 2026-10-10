import { isPrefLeaf, isPrefSection, prefGroupIsPage } from '@weasel-js/prefs';
import type { PrefDropMark } from '../Prefs';
import { GENERAL, generalKeys } from './generalBranch';
import { childrenOf, fitsUnder, isUnder, keyOf, nodeAt, parentPath, pathOf, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';

/**
 * Where a drop on the live preview lands in the schema: `mark` is what the form says is under the pointer, `nodes`
 * are what is being dropped, and `paths` are where those already sit, none for a node not in the schema yet. Null
 * when the preview has nothing there to drop on, or the schema would not hold the nodes there.
 */
export function previewTarget(
  schema: SchemaRoot, mark: PrefDropMark | null, nodes: readonly SchemaNode[], paths: readonly string[],
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
  if (!nodes.every((n) => fitsUnder(host, n))) return null;
  if (dest !== null && paths.some((p) => dest === p || isUnder(dest, p))) return null;
  const keys = Object.keys(kids);
  return { parentPath: dest, index: into ? keys.length : keys.indexOf(keyOf(at!)) + (mark.where === 'after' ? 1 : 0) };
}

/** Whether a node not in the schema yet may be dropped under tree row `parentId`. */
export function treeTakesNew(schema: SchemaRoot, node: SchemaNode, parentId: string | null): boolean {
  if (!isPrefSection(schema) && (parentId === GENERAL || parentId === null)) {
    const loose = isPrefLeaf(node) || (!isPrefSection(node) && !prefGroupIsPage(node));
    // General holds what the root's own page draws; with no General yet, the top level takes anything.
    return parentId === GENERAL ? loose : !loose || generalKeys(schema).length === 0;
  }
  const host = nodeAt(schema, parentId);
  return !!host && !isPrefLeaf(host) && !!childrenOf(host) && fitsUnder(host, node);
}
