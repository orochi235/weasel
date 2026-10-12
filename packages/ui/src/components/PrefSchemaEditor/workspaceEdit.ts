import { gainsSetting, moveLayoutNodes, removeLayoutNodes, renameLayoutKey } from './layoutEdit';
import { pointersIn } from './pointers';
import {
  heldValuePaths, joinPath, moveNodes, outermost, parentPath, rebaseValuePaths, removeNode, removeNodes, renameKey, valueMove,
  type SchemaRoot, type SchemaTarget, type ValueMove,
} from './schemaEdit';
import { assetOf, type Asset, type Workspace } from './workspace';

/** What an edit that renames and moves nothing passes {@link editAsset}: an attribute set, an add, a copy, a removal. */
export const NO_MOVES: readonly ValueMove[] = [];

/**
 * `layout` after its dialog went from `before` to `after`: its pointers follow `moves`, and one goes when the node its
 * path named went, a field inside an `object` leaf as much as a setting. A pointer a move rewrote stays whatever it
 * names now, as an alias in the dialog does, and one whose path named nothing before is left as it was.
 */
function following(layout: SchemaRoot, before: SchemaRoot, after: SchemaRoot, moves: readonly ValueMove[]): SchemaRoot {
  const followed = rebaseValuePaths(layout, moves);
  const now = pointersIn(followed);
  const [held, holds] = [heldValuePaths(before), heldValuePaths(after)];
  const lost = pointersIn(layout)
    .filter(([, was], i) => now[i]![1].of === was.of && held.has(was.of) && !holds.has(was.of))
    .map(([path]) => path);
  // Not `removeNodes`: it takes a removed node's tree path for a value path, and would drop a pointer naming a live setting there.
  return lost.reduce((root, path) => removeNode(root, path), followed);
}

/**
 * `workspace` with the asset `id` holding `next`; `workspace` itself when that asset is read-only, or is a layout and
 * `next` would give it a setting of its own. Every layout over an edited dialog follows, read-only ones included.
 *
 * A `next` in which a setting was renamed or moved must come with `moves`, each from the value path it had to the
 * one it has, a `null` for a node that has none. Nothing is worked out from the two roots, so a pointer to a setting
 * whose move is left out is dropped as naming one that went. {@link renameInAsset}, {@link moveInAsset}, and
 * {@link removeInAsset} make those edits and pass what they moved; call this with {@link NO_MOVES} for the rest.
 */
export function editAsset(workspace: Workspace, id: string, next: SchemaRoot, moves: ReadonlyArray<ValueMove | null>): Workspace {
  const asset = assetOf(workspace, id);
  if (!asset || asset.readOnly || asset.root === next) return workspace;
  if (asset.kind === 'layout' && gainsSetting(asset.root, next)) return workspace;
  // The first move to match a path is the one it follows, and a setting's own outranks that of a group above it.
  const ordered = moves.filter((m) => m !== null).sort((a, b) => b[0].length - a[0].length);
  return {
    assets: workspace.assets.map((a) => {
      if (a.id === id) return { ...a, root: next };
      if (asset.kind !== 'schema' || a.kind !== 'layout' || a.over !== id) return a;
      const root = following(a.root, asset.root, next, ordered);
      return root === a.root ? a : { ...a, root };
    }),
  };
}

function editable(workspace: Workspace, id: string): Asset | undefined {
  const asset = assetOf(workspace, id);
  return asset?.readOnly ? undefined : asset;
}

/** `workspace` with the node at `path` in the asset `id` under the key `nextKey`; `workspace` itself for a read-only asset. */
export function renameInAsset(workspace: Workspace, id: string, path: string, nextKey: string): Workspace {
  const asset = editable(workspace, id);
  if (!asset) return workspace;
  if (asset.kind === 'layout') return editAsset(workspace, id, renameLayoutKey(asset.root, path, nextKey), NO_MOVES);
  return editAsset(workspace, id, renameKey(asset.root, path, nextKey), [valueMove(asset.root, path, joinPath(parentPath(path), nextKey))]);
}

/**
 * `workspace` with the nodes at `paths` in the asset `id` moved to `target`, and `from` and `paths` as `moveNodes`
 * gives them. A read-only asset reads as a move that put nothing anywhere new.
 */
export function moveInAsset(
  workspace: Workspace, id: string, paths: readonly string[], target: SchemaTarget,
): { workspace: Workspace; from: string[]; paths: string[] } {
  const asset = editable(workspace, id);
  if (!asset) return { workspace, from: outermost(paths), paths: outermost(paths) };
  const isLayout = asset.kind === 'layout';
  const moved = isLayout ? moveLayoutNodes(asset.root, paths, target) : moveNodes(asset.root, paths, target);
  const moves = isLayout ? NO_MOVES : moved.from.map((from, i) => valueMove(asset.root, from, moved.paths[i]!));
  return { workspace: editAsset(workspace, id, moved.root, moves), from: moved.from, paths: moved.paths };
}

/** `workspace` without the nodes at `paths` in the asset `id`; `workspace` itself for a read-only asset. */
export function removeInAsset(workspace: Workspace, id: string, paths: readonly string[]): Workspace {
  const asset = editable(workspace, id);
  if (!asset) return workspace;
  return editAsset(workspace, id, asset.kind === 'layout' ? removeLayoutNodes(asset.root, paths) : removeNodes(asset.root, paths), NO_MOVES);
}
