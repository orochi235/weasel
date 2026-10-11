import { checkPrefCondition, isPrefLeaf, type PrefConditionProblem, type PrefLeaf } from '@weasel-js/prefs';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** One thing wrong with a node's `showIf` or its `enableIf`. */
export interface ConditionMark extends PrefConditionProblem {
  field: 'showIf' | 'enableIf';
}

/**
 * What is wrong with each condition `root` holds, by the tree path of the node holding it, `null` for the root, in
 * tree order; a node whose conditions are sound has no entry. The condition of a list's or a map's entry counts as
 * the list's, which is the row the tree draws.
 */
export function conditionProblems(root: SchemaRoot): Map<string | null, ConditionMark[]> {
  const out = new Map<string | null, ConditionMark[]>();
  const own = (node: SchemaNode, path: string | null): void => {
    for (const field of ['showIf', 'enableIf'] as const) {
      if (node[field] === undefined) continue;
      const found = checkPrefCondition(node[field], root).map((problem) => ({ ...problem, field }));
      if (found.length > 0) out.set(path, [...(out.get(path) ?? []), ...found]);
    }
    const item = isPrefLeaf(node) && (node.kind === 'list' || node.kind === 'map') ? (node as { item?: PrefLeaf }).item : undefined;
    if (item) own(item, path);
  };
  const walk = (node: SchemaNode, path: string | null): void => {
    own(node, path);
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) walk(kid, joinPath(path, key));
  };
  walk(root, null);
  return out;
}
