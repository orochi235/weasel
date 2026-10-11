import { isPrefCondition, isPrefLeaf, isPrefSection, mapPrefConditionPaths, type PrefLeaf } from '@weasel-js/prefs';
import { childrenOf, keyOf, keysOf, nodeAt, pathOf, withChildren, type ChildMap, type SchemaNode, type SchemaRoot } from './schemaTree';

/**
 * The path a leaf's value is read and written at, which is what an alias names: the leaf's own key under a section
 * root, and under a group root every key down to it but a section's, which is a heading inside an `object` leaf.
 */
export function valuePathOf(root: SchemaRoot, path: string): string {
  if (isPrefSection(root)) return keyOf(path);
  const keys = keysOf(path);
  // A path a node is about to take has no node at its end yet.
  const isHeading = (i: number): boolean => {
    const node = nodeAt(root, pathOf(keys.slice(0, i + 1)));
    return node !== undefined && isPrefSection(node);
  };
  return keys.filter((_, i) => !isHeading(i)).join('.');
}

export type ValueMove = readonly [from: string, to: string];

/** The value paths a node going from tree path `from` to `to` takes along; `null` for a section, whose key is no part of one. */
export function valueMove(root: SchemaRoot, from: string, to: string): ValueMove | null {
  const node = nodeAt(root, from);
  return node && isPrefSection(node) ? null : [valuePathOf(root, from), valuePathOf(root, to)];
}

/** `root` with `fn` applied to every node, a list's or a map's entry among them; the same object where none changed. */
function mapNodes<R extends SchemaRoot>(root: R, fn: (node: SchemaNode) => SchemaNode): R {
  const go = (node: SchemaNode): SchemaNode => {
    let self = fn(node);
    const item = isPrefLeaf(node) && (node.kind === 'list' || node.kind === 'map') ? (node as { item?: PrefLeaf }).item : undefined;
    const entry = item && go(item);
    if (entry !== item) self = { ...self, item: entry } as SchemaNode;
    const kids = childrenOf(node);
    if (!kids) return self;
    let changed = false;
    const mapped: ChildMap = {};
    for (const [key, kid] of Object.entries(kids)) {
      mapped[key] = go(kid);
      if (mapped[key] !== kid) changed = true;
    }
    return changed ? withChildren(self, mapped) : self;
  };
  return go(root) as R;
}

/** `path` where `moves` leave it: a moved value path, or one under it, goes where that went. */
function rebased(path: string, moves: ReadonlyArray<readonly [from: string, to: string]>): string {
  for (const [from, to] of moves) {
    if (path === from) return to;
    if (path.startsWith(`${from}.`)) return to + path.slice(from.length);
  }
  return path;
}

/** The value paths a leaf holds to others, followed through `moves`: an alias's `of`, a pair's `with`, and a `field` leaf's default. */
function rebasedLeaf(leaf: PrefLeaf, moves: readonly ValueMove[]): PrefLeaf {
  let next = leaf;
  const held = leaf.kind === 'alias' ? 'of' : leaf.kind === 'field' ? 'default' : undefined;
  const path = held === undefined ? undefined : (leaf as unknown as Record<string, unknown>)[held];
  if (held !== undefined && typeof path === 'string' && rebased(path, moves) !== path) next = { ...next, [held]: rebased(path, moves) } as PrefLeaf;
  const pair = leaf.pair;
  if (pair !== undefined) {
    const partners = typeof pair.with === 'string' ? rebased(pair.with, moves) : pair.with.map((p) => rebased(p, moves));
    if (String(partners) !== String(pair.with)) next = { ...next, pair: { ...pair, with: partners } };
  }
  return next;
}

/**
 * `root` with every value path a node holds to a leaf followed through `moves`: the paths a `showIf` or an
 * `enableIf` reads, on a leaf, a group, or a section, and a leaf's own (an alias's `of`, a pair's `with`, a `field`
 * leaf's default).
 */
export function rebaseValuePaths<R extends SchemaRoot>(root: R, moves: ReadonlyArray<ValueMove | null>): R {
  const live = moves.filter((m): m is ValueMove => m !== null && m[0] !== m[1]);
  if (live.length === 0) return root;
  return mapNodes(root, (node) => {
    let next: SchemaNode = isPrefLeaf(node) ? rebasedLeaf(node, live) : node;
    for (const field of ['showIf', 'enableIf'] as const) {
      const held = node[field];
      // Anything else that sits where a condition goes is left for the check that reports it.
      if (!isPrefCondition(held)) continue;
      const followed = mapPrefConditionPaths(held, (path) => rebased(path, live));
      if (followed !== held) next = { ...next, [field]: followed } as SchemaNode;
    }
    return next;
  });
}
