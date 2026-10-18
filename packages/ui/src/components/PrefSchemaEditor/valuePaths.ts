import { isPrefCondition, isPrefLeaf, isPrefSection, mapPrefConditionPaths, PREF_ENTRY, type PrefLeaf } from '@weasel-js/prefs';
import { childrenOf, innerOf, joinPath, keysOf, nodeAt, ownChildrenOf, pathOf, slotOf, withChildren, type ChildMap, type SchemaNode, type SchemaRoot } from './schemaTree';

/**
 * The path a leaf's value is read and written at, which is what an alias names: every key down to it but a
 * section's, which is a heading. So under a section root it is the leaf's own key, and a field's after it. A field
 * of a list's or a map's entry is read in every entry, so the entry's step is written `*` (`'phases.*.mode'`).
 */
export function valuePathOf(root: SchemaRoot, path: string): string {
  const keys = keysOf(path);
  const out: string[] = [];
  keys.forEach((key, i) => {
    // A path a node is about to take has no node at its end yet.
    const node = nodeAt(root, pathOf(keys.slice(0, i + 1)));
    if (node !== undefined && isPrefSection(node)) return;
    out.push(key);
    if (node !== undefined && i < keys.length - 1 && slotOf(node) === 'item') out.push(PREF_ENTRY);
  });
  return out.join('.');
}

/**
 * The value paths the node at tree path `path` holds: its own, which every path beneath it extends, or for a
 * section, and for the root, each of its children's.
 */
export function valuePathsAt(root: SchemaRoot, path: string | null, node: SchemaNode): string[] {
  if (path !== null && !isPrefSection(node)) return [valuePathOf(root, path)];
  return Object.entries(childrenOf(node) ?? {}).flatMap(([key, kid]) => valuePathsAt(root, joinPath(path, key), kid));
}

/**
 * Every value path a node of `root` holds: a leaf's, a group's, and a field's inside an `object` leaf, which no
 * alias can show and a path can still name.
 */
export function heldValuePaths(root: SchemaRoot): Set<string> {
  const out = new Set<string>();
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) {
      const at = joinPath(path, key);
      if (!isPrefSection(kid)) out.add(valuePathOf(root, at));
      walk(kid, at);
    }
  };
  walk(root, null);
  return out;
}

export type ValueMove = readonly [from: string, to: string];

/** The value paths a node going from tree path `from` to `to` takes along; `null` for a section, whose key is no part of one. */
export function valueMove(root: SchemaRoot, from: string, to: string): ValueMove | null {
  const node = nodeAt(root, from);
  return node && isPrefSection(node) ? null : [valuePathOf(root, from), valuePathOf(root, to)];
}

const under = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);

/**
 * `root` with `fn` applied to every node, a list's or a map's entry and a union's variants among them; the same
 * object where none changed. `fn` is told the value path of the entry the node is drawn in, its step written `*`
 * (`'phases.*'`): the item's own for the item, and `undefined` outside every list and map.
 */
function mapNodes<R extends SchemaRoot>(root: R, fn: (node: SchemaNode, entry: string | undefined) => SchemaNode): R {
  /** `at(key, kid)` is the value path of each kid. */
  const each = <M extends ChildMap>(kids: M, at: (key: string, kid: SchemaNode) => string, entry: string | undefined): M => {
    const mapped = Object.fromEntries(Object.entries(kids).map(([key, kid]) => [key, go(kid, at(key, kid), entry)]));
    return Object.keys(kids).every((key) => mapped[key] === kids[key]) ? kids : (mapped as M);
  };
  const go = (node: SchemaNode, at: string, entry: string | undefined): SchemaNode => {
    let self = fn(node, entry);
    const { item, variants } = innerOf(node);
    const itemAt = under(at, PREF_ENTRY);
    const held = item && go(item, itemAt, itemAt);
    if (held !== item) self = { ...self, item: held } as SchemaNode;
    // A variant's fields are read at the union's own path.
    const shapes = variants && each(variants, () => at, entry);
    if (shapes !== variants) self = { ...self, variants: shapes } as SchemaNode;
    // An entry's fields were mapped with the entry.
    const kids = ownChildrenOf(node);
    // A section's key is a heading, and no part of the paths under it.
    const mapped = kids && each(kids, (key, kid) => (isPrefSection(kid) ? at : under(at, key)), entry);
    return mapped === kids ? self : withChildren(self, mapped!);
  };
  return go(root, '', undefined) as R;
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
 * `enableIf` reads, on a leaf, a group, a section, or anything inside a list's entry or a union's variants, and a
 * leaf's own (an alias's `of`, a pair's `with`, a `field`
 * leaf's default). A path a condition reads from its entry (`from: 'item'`) follows a move of that field of the
 * entry, which a move names with `*` for the entry's step (`'phases.*.mode'`), and nothing outside the entry.
 */
export function rebaseValuePaths<R extends SchemaRoot>(root: R, moves: ReadonlyArray<ValueMove | null>): R {
  const live = moves.filter((m): m is ValueMove => m !== null && m[0] !== m[1]);
  if (live.length === 0) return root;
  return mapNodes(root, (node, entry) => {
    const inEntry = (path: string): string => {
      if (entry === undefined || path === '') return path;
      const base = rebased(entry, live);
      const to = rebased(`${entry}.${path}`, live);
      return to.startsWith(`${base}.`) ? to.slice(base.length + 1) : path;
    };
    let next: SchemaNode = isPrefLeaf(node) ? rebasedLeaf(node, live) : node;
    for (const field of ['showIf', 'enableIf'] as const) {
      const held = node[field];
      // Anything else that sits where a condition goes is left for the check that reports it.
      if (!isPrefCondition(held)) continue;
      const followed = mapPrefConditionPaths(held, (path, from) => (from === 'item' ? inEntry(path) : rebased(path, live)));
      if (followed !== held) next = { ...next, [field]: followed } as SchemaNode;
    }
    return next;
  });
}
