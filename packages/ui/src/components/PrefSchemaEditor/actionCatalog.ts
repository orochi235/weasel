import { isPrefLeaf, type PrefAction, type PrefGroup } from '@weasel-js/prefs';
import { actionLeaf, actionLeafKey, type EditorAction } from './editorActions';
import { childrenOf, joinPath, keyOf, nodeAt, outermost, parentPath, removeNode, uniqueKey, type ChildMap, type SchemaNode } from './schemaEdit';
import { editChildren, insertAt } from './schemaTree';

/** A catalog that holds nothing yet. */
export const NO_CATALOG: PrefGroup = { name: 'Actions', description: '', children: {} };

/** The key an `action` pref fires; `undefined` for any other node, or one that runs its own code. */
export const firedBy = (node: SchemaNode): string | undefined =>
  (isPrefLeaf(node) && node.kind === 'action' ? (node as PrefAction).action : undefined);

function firedIn(node: SchemaNode, out: Set<string>): Set<string> {
  const key = firedBy(node);
  if (key !== undefined) out.add(key);
  for (const child of Object.values(childrenOf(node) ?? {})) firedIn(child, out);
  return out;
}

/** The parts of an action key, each with the `.` or `:` that ends it. */
const partsOf = (key: string): string[] => key.split(/(?<=[.:])/).filter((part) => /[^.:]/.test(part));

const title = (part: string): string => part.charAt(0).toUpperCase() + part.slice(1);

/** `group` with a pref firing `action` under the groups `parts` name from it down, each made where there is none. */
function fileUnder(group: PrefGroup, parts: readonly string[], action: EditorAction): PrefGroup {
  const kids: ChildMap = group.children;
  const [head, ...rest] = parts;
  if (head === undefined) return { ...group, children: { ...group.children, [uniqueKey(kids, actionLeafKey(action.key))]: actionLeaf(action) } };
  const key = actionLeafKey(head);
  // By name too: a group made beside a pref that had its key took another.
  const at = [key, ...Object.keys(kids)].find((k) => Object.hasOwn(kids, k) && !isPrefLeaf(kids[k]!) && (k === key || kids[k]!.name === title(head)))
    ?? uniqueKey(kids, key);
  const under = (kids[at] as PrefGroup | undefined) ?? { name: title(head), description: '', children: {} };
  return { ...group, children: { ...group.children, [at]: fileUnder(under, rest, action) } };
}

/**
 * `catalog` with a pref for each of `actions` that none of its prefs fires, filed by its key's path: `edit.undo`
 * under the group `edit`, and a variant `align:left` under `align`, each group made after what is there where
 * there is none. An action whose key is one part goes at the catalog's end. `catalog` itself where every action
 * is fired already, wherever the reader has put it.
 */
export function filed(catalog: PrefGroup, actions: readonly EditorAction[]): PrefGroup {
  const fired = firedIn(catalog, new Set());
  const missing = actions.filter((action) => !fired.has(action.key) && !!fired.add(action.key));
  const above = (action: EditorAction): string[] => partsOf(action.key).slice(0, -1).map((part) => part.slice(0, -1));
  // Groups before the prefs beside them, as a reader would look for them.
  const ordered = [...missing.filter((a) => above(a).length > 0), ...missing.filter((a) => above(a).length === 0)];
  return ordered.reduce((root, action) => fileUnder(root, above(action), action), catalog);
}

/** A catalog of `actions` filed by their keys: what a host starts an `actions` asset from. */
export function actionCatalog(actions: readonly EditorAction[]): PrefGroup {
  return filed(NO_CATALOG, actions);
}

function keysUnder(node: SchemaNode): string[][] {
  const key = firedBy(node);
  return [...(key === undefined ? [] : [partsOf(key)]), ...Object.values(childrenOf(node) ?? {}).flatMap(keysUnder)];
}

/**
 * What each row of `catalog` shows of the keys under it, by tree path: a group, the part of the key path every
 * action under it shares past what the groups above it show, and a pref, what is left of its action's key. So a
 * group the reader has filled with actions from all over shows nothing, and its prefs their whole keys.
 */
export function keyTails(catalog: PrefGroup): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: SchemaNode, path: string | null, said: number): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const at = joinPath(path, key);
      const fires = firedBy(child);
      if (fires !== undefined) out.set(at, partsOf(fires).slice(said).join('') || fires);
      if (!childrenOf(child)) continue;
      const keys = keysUnder(child);
      // Short of a whole key: every pref keeps a part of its own to show.
      const most = Math.min(...keys.map((parts) => parts.length - 1));
      let shared = said;
      while (keys.length > 0 && shared < most && keys.every((parts) => parts[shared] === keys[0]![shared])) shared++;
      out.set(at, keys.length === 0 ? '' : keys[0]!.slice(said, shared).join('').replace(/[.:]$/, ''));
      walk(child, at, shared);
    }
  };
  walk(catalog, null, 0);
  return out;
}

/**
 * `catalog` with the nodes at `paths` taken out of it, as far as each can be: a group gives what it holds to the
 * group above it, where it sat, and a pref goes only if it fires none of `live`, since every registered action
 * stays listed. `catalog` itself where nothing goes.
 */
export function dissolve(catalog: PrefGroup, paths: readonly string[], live: ReadonlySet<string>): PrefGroup {
  return outermost(paths).reduce((root, path) => {
    const node = nodeAt(root, path);
    if (!node) return root;
    const held = childrenOf(node);
    if (!held) return live.has(firedBy(node) ?? '') ? root : removeNode(root, path);
    return editChildren(root, parentPath(path), (kids) => {
      const index = Object.keys(kids).indexOf(keyOf(path));
      const { [keyOf(path)]: _gone, ...rest } = kids;
      const taken: ChildMap = { ...rest };
      const lifted = Object.entries(held).map(([key, child]): [string, SchemaNode] => {
        const unique = uniqueKey(taken, key);
        taken[unique] = child;
        return [unique, child];
      });
      return insertAt(rest, lifted, index);
    });
  }, catalog);
}
