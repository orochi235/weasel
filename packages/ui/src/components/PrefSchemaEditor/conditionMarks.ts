import { checkPrefCondition, type PrefConditionProblem, type PrefConditionSite, type PrefList, type PrefMap } from '@weasel-js/prefs';
import { childrenOf, innerOf, joinPath, slotOf, type SchemaNode, type SchemaRoot } from './schemaTree';

/** One thing wrong with a node's `showIf` or its `enableIf`. */
export interface ConditionMark extends PrefConditionProblem {
  field: 'showIf' | 'enableIf';
}

/**
 * What is wrong with each condition `root` holds, by the tree path of the node holding it, `null` for the root, in
 * tree order; a node whose conditions are sound has no entry. A condition anywhere inside a list's or a map's entry,
 * or a union's variants, counts as that leaf's, which is the row the tree draws, but on a field of an object entry,
 * which has a row of its own. `over` is the schema `root` is
 * drawn over, as a layout is over its dialog's: a condition may read its settings.
 */
export function conditionProblems(root: SchemaRoot, over?: SchemaRoot): Map<string | null, ConditionMark[]> {
  const out = new Map<string | null, ConditionMark[]>();
  type Holder = PrefList | PrefMap | undefined;
  const own = (node: SchemaNode, path: string | null, within: Holder, isItem = false): void => {
    for (const field of ['showIf', 'enableIf'] as const) {
      if (node[field] === undefined) continue;
      const site: PrefConditionSite = { ...(within ? { within } : {}), ...(isItem && field === 'showIf' ? { itemShowIf: true } : {}) };
      const found = checkPrefCondition(node[field], root, site, over).map((problem) => ({ ...problem, field }));
      if (found.length > 0) out.set(path, [...(out.get(path) ?? []), ...found]);
    }
  };
  /** What `node` keeps with no row of its own, counted at `path`: a list's or a map's entry, and a union's variants. */
  const inner = (node: SchemaNode, path: string | null, within: Holder): void => {
    const { item, variants } = innerOf(node);
    // An entry whose fields are rows counts only its own conditions here; they are walked as children.
    if (item && slotOf(node) === 'item') own(item, path, node as PrefList | PrefMap, true);
    else if (item) rowless(item, path, node as PrefList | PrefMap, true);
    for (const variant of Object.values(variants ?? {})) rowless(variant, path, within);
  };
  /** The entry the nodes under `node` sit in. */
  const holderUnder = (node: SchemaNode, within: Holder): Holder => (slotOf(node) === 'item' ? (node as PrefList | PrefMap) : within);
  /** A node the tree draws no row for, and everything under it, counted at `path`. */
  const rowless = (node: SchemaNode, path: string | null, within: Holder, isItem = false): void => {
    own(node, path, within, isItem);
    inner(node, path, within);
    for (const held of Object.values(childrenOf(node) ?? {})) rowless(held, path, holderUnder(node, within));
  };
  const walk = (node: SchemaNode, path: string | null, within: Holder): void => {
    own(node, path, within);
    inner(node, path, within);
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) walk(kid, joinPath(path, key), holderUnder(node, within));
  };
  walk(root, null, undefined);
  return out;
}
