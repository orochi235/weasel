import { isPrefLeaf, prefAliasedLeaf, prefAliasTarget, prefLeafAt, type PrefAlias, type PrefLeaf } from '@weasel-js/prefs';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';

/**
 * The attributes of a pointer its form offers. Only where it points: a pointer takes everything else from its
 * setting. An override is turned on by naming its attribute here; `prefAliasedLeaf` already merges `name` and
 * `description`.
 */
export const POINTER_ATTRS: readonly string[] = ['of'];

/** The setting a pointer names in `over`, and the path its value lives at; `undefined` when it names none. */
export function pointerTarget(over: SchemaRoot, pointer: PrefAlias): { path: string; leaf: PrefLeaf } | undefined {
  return prefAliasTarget(pointer, (path) => prefLeafAt(over, path));
}

/** What a pointer draws as: its setting, under whatever the pointer says for itself. */
export function drawnLeaf(over: SchemaRoot, pointer: PrefAlias): PrefLeaf | undefined {
  const target = pointerTarget(over, pointer);
  return target && prefAliasedLeaf(pointer, target.leaf);
}

/** Every pointer in `layout`, by its path in the tree. */
export function pointersIn(layout: SchemaRoot): Array<[path: string, pointer: PrefAlias]> {
  const out: Array<[string, PrefAlias]> = [];
  const walk = (node: SchemaNode, path: string | null) => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const at = joinPath(path, key);
      if (isPrefLeaf(child) && child.kind === 'alias') out.push([at, child as PrefAlias]);
      walk(child, at);
    }
  };
  walk(layout, null);
  return out;
}

/** The paths in `layout` of the pointers that name no setting in `over`. */
export function deadPointers(layout: SchemaRoot, over: SchemaRoot): string[] {
  return pointersIn(layout).filter(([, p]) => pointerTarget(over, p) === undefined).map(([path]) => path);
}
