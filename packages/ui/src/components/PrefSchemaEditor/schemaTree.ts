import { isPrefLeaf, isPrefSection, type PrefGroup, type PrefLeaf, type PrefSection } from '@weasel-js/prefs';

/** A schema the editor opens: a preferences schema, or a node's property schema. */
export type SchemaRoot = PrefGroup | PrefSection;
/** A node of a schema. Under a `PrefGroup` root a section appears only inside an `object` leaf. */
export type SchemaNode = PrefLeaf | PrefGroup | PrefSection;
export type ChildMap = Record<string, SchemaNode>;

/**
 * A node's address in the tree: the keys from the root down, joined by `/`. Not the path its value is stored at —
 * a section's key is no part of that one, and a leaf's key under a section may be a dotted path itself.
 */
const SEP = '/';

/** Where moved nodes land: among `parentPath`'s children (`null` is the root), at `index` counted before the move. */
export interface SchemaTarget {
  parentPath: string | null;
  index: number;
}

/**
 * The attribute a node keeps the nodes under it in, or `undefined` for a node the tree shows as one row: a leaf
 * of any kind but `object`, and an `object` leaf made from a type, whose fields are its type's to say.
 */
export function slotOf(node: SchemaNode): 'children' | 'members' | undefined {
  if (isPrefSection(node)) return 'members';
  if (!isPrefLeaf(node)) return 'children';
  return node.kind === 'object' && node.type === undefined ? 'children' : undefined;
}

/** The nodes under `node`, by key: a group's or an `object` leaf's children, or a section's members. `undefined`
 *  for anything that holds none. */
export function childrenOf(node: SchemaNode): ChildMap | undefined {
  const slot = slotOf(node);
  return slot === undefined ? undefined : ((node as unknown as Record<string, unknown>)[slot] as ChildMap);
}

/** Which branch `parent` nests: a group holds groups, and an `object` leaf or a section holds sections. */
export function branchUnder(parent: SchemaNode): 'group' | 'section' {
  return isPrefLeaf(parent) || isPrefSection(parent) ? 'section' : 'group';
}

/** Whether `node` may be put directly under `parent`: any leaf, or the branch `parent` nests. */
export function fitsUnder(parent: SchemaNode, node: SchemaNode): boolean {
  return isPrefLeaf(node) || (isPrefSection(node) ? 'section' : 'group') === branchUnder(parent);
}

/** How many levels of groups `node` adds where it sits: none for a leaf or a section, one for a group and one more for each level inside it. */
export function levelsOf(node: SchemaNode): number {
  if (isPrefLeaf(node) || isPrefSection(node)) return 0;
  return 1 + Math.max(0, ...Object.values(node.children).map(levelsOf));
}

/** Whether `nodes` set under the group at `parent` keep the schema within `maxDepth` levels of groups. */
export function withinDepth(parent: string | null, nodes: readonly SchemaNode[], maxDepth: number | undefined): boolean {
  return maxDepth === undefined || nodes.every((n) => levelsOf(n) === 0 || keysOf(parent).length + levelsOf(n) <= maxDepth);
}

export function checkFits(parent: SchemaNode | undefined, node: SchemaNode): void {
  if (!parent || !childrenOf(parent) || fitsUnder(parent, node)) return;
  throw new Error(`schemaEdit: only a ${branchUnder(parent)} nests here`);
}

export function parentPath(path: string): string | null {
  const i = path.lastIndexOf(SEP);
  return i === -1 ? null : path.slice(0, i);
}

export function keyOf(path: string): string {
  return path.slice(path.lastIndexOf(SEP) + 1);
}

export function joinPath(parent: string | null, key: string): string {
  return parent === null ? key : `${parent}${SEP}${key}`;
}

/** The keys from the root down to `path`; none for the root. */
export function keysOf(path: string | null): string[] {
  return path === null ? [] : path.split(SEP);
}

/** The path `keys` lead to; `null`, the root, for none. */
export function pathOf(keys: readonly string[]): string | null {
  return keys.length === 0 ? null : keys.join(SEP);
}

/** Whether `path` lies beneath `ancestor`. */
export function isUnder(path: string, ancestor: string): boolean {
  return path.startsWith(`${ancestor}${SEP}`);
}

/** `paths` less any that lies beneath another of them. */
export function outermost(paths: readonly string[]): string[] {
  return paths.filter((p) => !paths.some((q) => isUnder(p, q)));
}

function ownChild(kids: ChildMap | undefined, key: string): SchemaNode | undefined {
  return kids && Object.hasOwn(kids, key) ? kids[key] : undefined;
}

export function nodeAt(root: SchemaRoot, path: string | null): SchemaNode | undefined {
  let cur: SchemaNode | undefined = root;
  for (const k of keysOf(path)) cur = cur && ownChild(childrenOf(cur), k);
  return cur;
}

export function withChildren(node: SchemaNode, kids: ChildMap): SchemaNode {
  return { ...node, [slotOf(node)!]: kids } as SchemaNode;
}

/** `root` with the children of the node at `parent` replaced by `edit` of them. */
export function editChildren<R extends SchemaRoot>(root: R, parent: string | null, edit: (kids: ChildMap) => ChildMap): R {
  const keys = keysOf(parent);
  const go = (node: SchemaNode, depth: number): SchemaNode => {
    const kids = childrenOf(node);
    const here = pathOf(keys.slice(0, depth)) ?? '(root)';
    if (!kids) throw new Error(`schemaEdit: ${here} cannot hold children`);
    if (depth === keys.length) return withChildren(node, edit(kids));
    const k = keys[depth]!;
    const child = kids[k];
    if (!child) throw new Error(`schemaEdit: no node at ${pathOf(keys.slice(0, depth + 1))}`);
    return withChildren(node, { ...kids, [k]: go(child, depth + 1) });
  };
  return go(root, 0) as R;
}

export function insertAt(kids: ChildMap, entries: Array<[string, SchemaNode]>, index: number): ChildMap {
  const list = Object.entries(kids);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, ...entries);
  return Object.fromEntries(list);
}
