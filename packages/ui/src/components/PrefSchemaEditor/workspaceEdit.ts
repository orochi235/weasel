import { prefLeafAt } from '@weasel-js/prefs';
import { pointersIn } from './pointers';
import { joinPath, parentPath, rebaseValuePaths, removeNode, valueMove, type SchemaRoot, type ValueMove } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';

const settled = (moves: ReadonlyArray<ValueMove | null>): ValueMove[] => moves.filter((m): m is ValueMove => m !== null && m[0] !== m[1]);

/** The value moves of a `moveNodes` on `before` that took the nodes at `from` to `to`, its result's `from` and `paths`. */
export function movesOfMove(before: SchemaRoot, from: readonly string[], to: readonly string[]): ValueMove[] {
  return settled(from.map((f, i) => valueMove(before, f, to[i]!)));
}

/** The value moves of a `renameKey` on `before` that gave the node at `path` the key `nextKey`. */
export function movesOfRename(before: SchemaRoot, path: string, nextKey: string): ValueMove[] {
  return settled([valueMove(before, path, joinPath(parentPath(path), nextKey))]);
}

/**
 * `layout` after its dialog went from `before` to `after`: its pointers follow `moves`, and one whose setting went
 * goes too. A pointer a move rewrote stays whatever it names now, as an alias in the dialog does.
 */
function following(layout: SchemaRoot, before: SchemaRoot, after: SchemaRoot, moves: readonly ValueMove[]): SchemaRoot {
  const followed = rebaseValuePaths(layout, moves);
  const now = pointersIn(followed);
  const lost = pointersIn(layout)
    .filter(([, was], i) => now[i]![1].of === was.of && prefLeafAt(before, was.of) !== undefined && prefLeafAt(after, was.of) === undefined)
    .map(([path]) => path);
  // Not `removeNodes`: it takes a removed node's tree path for a value path, and would drop a pointer naming a live setting there.
  return lost.reduce((root, path) => removeNode(root, path), followed);
}

/**
 * `workspace` with the asset `id` holding `next`; `workspace` itself when that asset is read-only.
 *
 * `moves` must be every value move the edit to a dialog made, each from its path before the edit to its path after:
 * {@link movesOfMove} for a `moveNodes`, {@link movesOfRename} for a `renameKey`, and none for any other edit.
 * Nothing is worked out from the two roots, so a move left out leaves its pointers behind, to be dropped as naming
 * a setting that went. Every layout over an edited dialog follows, read-only ones included.
 */
export function editAsset(workspace: Workspace, id: string, next: SchemaRoot, moves: readonly ValueMove[] = []): Workspace {
  const asset = assetOf(workspace, id);
  if (!asset || asset.readOnly || asset.root === next) return workspace;
  // The first move to match a path is the one it follows, and a setting's own outranks that of a group above it.
  const ordered = [...moves].sort((a, b) => b[0].length - a[0].length);
  return {
    assets: workspace.assets.map((a) => {
      if (a.id === id) return { ...a, root: next };
      if (asset.kind !== 'schema' || a.kind !== 'layout' || a.over !== id) return a;
      const root = following(a.root, asset.root, next, ordered);
      return root === a.root ? a : { ...a, root };
    }),
  };
}
