import { checkPrefCondition, type PrefConditionProblem } from '@weasel-js/prefs';
import { childrenOf, innerOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaTree';

/** One thing wrong with a node's `showIf` or its `enableIf`. */
export interface ConditionMark extends PrefConditionProblem {
  field: 'showIf' | 'enableIf';
}

/**
 * What is wrong with each condition `root` holds, by the tree path of the node holding it, `null` for the root, in
 * tree order; a node whose conditions are sound has no entry. A condition anywhere inside a list's or a map's entry,
 * or a union's variants, counts as that leaf's, which is the row the tree draws.
 */
export function conditionProblems(root: SchemaRoot): Map<string | null, ConditionMark[]> {
  const out = new Map<string | null, ConditionMark[]>();
  const own = (node: SchemaNode, path: string | null): void => {
    for (const field of ['showIf', 'enableIf'] as const) {
      if (node[field] === undefined) continue;
      const found = checkPrefCondition(node[field], root).map((problem) => ({ ...problem, field }));
      if (found.length > 0) out.set(path, [...(out.get(path) ?? []), ...found]);
    }
  };
  const inner = (node: SchemaNode): SchemaNode[] => {
    const { item, variants } = innerOf(node);
    return [...(item ? [item] : []), ...Object.values(variants ?? {})];
  };
  /** A node the tree draws no row for, and everything under it, counted at `path`. */
  const rowless = (node: SchemaNode, path: string | null): void => {
    own(node, path);
    for (const held of [...inner(node), ...Object.values(childrenOf(node) ?? {})]) rowless(held, path);
  };
  const walk = (node: SchemaNode, path: string | null): void => {
    own(node, path);
    for (const held of inner(node)) rowless(held, path);
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) walk(kid, joinPath(path, key));
  };
  walk(root, null);
  return out;
}
