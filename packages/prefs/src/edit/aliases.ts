import { isPrefLeaf, prefAliasedLeaf, prefAliasTarget, prefLeafAt, type PrefAlias, type PrefLeaf } from '../index';
import type { AttributeSchema, KindAttrs } from './kindSchemas';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';

/**
 * The attributes of an alias its form offers. Only where it points: an alias takes everything else from its
 * setting. An override is turned on by naming its attribute here; `prefAliasedLeaf` already merges `name` and
 * `description`.
 */
export const ALIAS_ATTRS: readonly string[] = ['of'];

/** A node's `attributes` less what an alias's form does not offer. */
export function aliasAttributes(attributes: AttributeSchema): AttributeSchema {
  const offered = (part: KindAttrs): KindAttrs => Object.fromEntries(Object.entries(part).filter(([name]) => ALIAS_ATTRS.includes(name)));
  return { shared: offered(attributes.shared), own: offered(attributes.own), auto: {}, entry: {}, readOnly: [] };
}

/** The setting an alias names in `over`, and the path its value lives at; `undefined` when it names none. */
export function aliasTargetIn(over: SchemaRoot, alias: PrefAlias): { path: string; leaf: PrefLeaf } | undefined {
  return prefAliasTarget(alias, (path) => prefLeafAt(over, path));
}

/** What an alias draws as: its setting, under whatever the alias says for itself. */
export function drawnLeaf(over: SchemaRoot, alias: PrefAlias): PrefLeaf | undefined {
  const target = aliasTargetIn(over, alias);
  return target && prefAliasedLeaf(alias, target.leaf);
}

/** Every alias in `layout`, by its path in the tree. */
export function aliasesIn(layout: SchemaRoot): Array<[path: string, alias: PrefAlias]> {
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

/** The paths in `layout` of the aliases that name no setting in `over`. */
export function deadAliases(layout: SchemaRoot, over: SchemaRoot): string[] {
  return aliasesIn(layout).filter(([, p]) => aliasTargetIn(over, p) === undefined).map(([path]) => path);
}
