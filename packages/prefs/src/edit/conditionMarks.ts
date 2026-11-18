import { getOwn } from '@weasel-js/registry';
import { checkPrefCondition, isPrefLeaf, isPrefSection, PREF_CONDITION_FIELDS, type PrefConditionField, type PrefConditionProblem, type PrefConditionSite, type PrefList, type PrefMap } from '../index';
import { childrenOf, innerOf, joinPath, keysOf, slotOf, type SchemaNode, type SchemaRoot } from './schemaTree';

/** One thing wrong with one of a node's conditions. */
export interface ConditionMark extends PrefConditionProblem {
  field: PrefConditionField;
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
  // `group` is the value path of the group a node is declared in. Groups sit only in groups, so a group's tree path
  // names its value path.
  const own = (node: SchemaNode, path: string | null, within: Holder, group: string, isItem = false): void => {
    const held = node as { [F in PrefConditionField]?: unknown };
    for (const field of PREF_CONDITION_FIELDS) {
      if (held[field] === undefined) continue;
      const site: PrefConditionSite = { group, ...(within ? { within } : {}), ...(isItem && field === 'showIf' ? { itemShowIf: true } : {}) };
      const found = checkPrefCondition(held[field], root, site, over).map((problem) => ({ ...problem, field }));
      if (found.length > 0) out.set(path, [...(out.get(path) ?? []), ...found]);
    }
  };
  /** What `node` keeps with no row of its own, counted at `path`: a list's or a map's entry, and a union's variants. */
  const inner = (node: SchemaNode, path: string | null, within: Holder, group: string): void => {
    const { item, variants } = innerOf(node);
    // An entry whose fields are rows counts only its own conditions here; they are walked as children.
    if (item && slotOf(node) === 'item') own(item, path, node as PrefList | PrefMap, group, true);
    else if (item) rowless(item, path, node as PrefList | PrefMap, group, true);
    for (const variant of Object.values(variants ?? {})) rowless(variant, path, within, group);
  };
  /** The group the nodes under `node`, at tree path `path`, are declared in. */
  const groupUnder = (node: SchemaNode, path: string | null, group: string): string =>
    isPrefLeaf(node as never) || isPrefSection(node as never) ? group : path === null ? '' : path.split('/').join('.');
  /** The entry the nodes under `node` sit in. */
  const holderUnder = (node: SchemaNode, within: Holder): Holder => (slotOf(node) === 'item' ? (node as PrefList | PrefMap) : within);
  /** A node the tree draws no row for, and everything under it, counted at `path`. */
  const rowless = (node: SchemaNode, path: string | null, within: Holder, group: string, isItem = false): void => {
    own(node, path, within, group, isItem);
    inner(node, path, within, group);
    for (const held of Object.values(childrenOf(node) ?? {})) rowless(held, path, holderUnder(node, within), group);
  };
  const walk = (node: SchemaNode, path: string | null, within: Holder, group: string): void => {
    own(node, path, within, group);
    inner(node, path, within, group);
    const kids = groupUnder(node, path, group);
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) walk(kid, joinPath(path, key), holderUnder(node, within), kids);
  };
  walk(root, null, undefined, '');
  return out;
}

/**
 * The value path of the group the node at tree path `path` is declared in, empty at the root: where a condition on it
 * reads a test read from its group (`from: 'group'`). `undefined` for the root itself, or a path naming no node.
 */
export function conditionGroupAt(root: SchemaRoot, path: string | null): string | undefined {
  const keys = keysOf(path);
  if (keys.length === 0) return undefined;
  let node: SchemaNode = root;
  let group = '';
  for (let i = 0; i < keys.length; i++) {
    const kids = childrenOf(node);
    const kid = kids && getOwn(kids, keys[i]!);
    if (kid === undefined) return undefined;
    if (i < keys.length - 1 && !isPrefLeaf(kid as never) && !isPrefSection(kid as never)) group = keys.slice(0, i + 1).join('.');
    node = kid;
  }
  return group;
}
