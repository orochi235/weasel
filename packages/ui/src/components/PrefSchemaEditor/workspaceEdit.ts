import { pointersIn, pointerTarget } from './pointers';
import { rebaseValuePaths, removeNode, valuePathOf, type SchemaRoot, type ValueMove } from './schemaEdit';
import { diffSchemas } from './schemaExport';
import { assetOf, type Workspace } from './workspace';

/** The value paths one edit moved: a setting renamed, or set under another group. */
export function valueMoves(before: SchemaRoot, after: SchemaRoot): ValueMove[] {
  return diffSchemas(before, after)
    .flatMap((c) => (c.op === 'move' ? [[valuePathOf(before, c.from), valuePathOf(after, c.to)] as const] : []))
    .filter(([from, to]) => from !== to);
}

/** `layout` after its dialog went from `before` to `after`: its pointers follow what moved, and one whose setting went goes too. */
function following(layout: SchemaRoot, before: SchemaRoot, after: SchemaRoot): SchemaRoot {
  const live = new Set(pointersIn(layout).filter(([, p]) => pointerTarget(before, p) !== undefined).map(([path]) => path));
  const followed = rebaseValuePaths(layout, valueMoves(before, after));
  const lost = pointersIn(followed).filter(([path, p]) => live.has(path) && pointerTarget(after, p) === undefined).map(([path]) => path);
  // Not `removeNodes`: it takes a removed node's tree path for a value path, and would drop a pointer naming a live setting there.
  return lost.reduce((root, path) => removeNode(root, path), followed);
}

/**
 * `workspace` with the asset `id` holding `next`. The one way a root is replaced: an edit to a dialog carries every
 * layout over it along, read-only ones too, since following is no edit of theirs. A read-only asset's own root is
 * not replaced.
 */
export function editAsset(workspace: Workspace, id: string, next: SchemaRoot): Workspace {
  const asset = assetOf(workspace, id);
  if (!asset || asset.readOnly || asset.root === next) return workspace;
  return {
    assets: workspace.assets.map((a) => {
      if (a.id === id) return { ...a, root: next };
      if (asset.kind !== 'schema' || a.kind !== 'layout' || a.over !== id) return a;
      const root = following(a.root, asset.root, next);
      return root === a.root ? a : { ...a, root };
    }),
  };
}
