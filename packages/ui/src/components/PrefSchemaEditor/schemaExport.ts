import { isPlainObject } from '@weasel-js/core';
import { isPrefLeaf, isPrefSection } from '@weasel-js/prefs';
import { childrenOf, isUnder, isValidKey, ITEM, joinPath, keysOf, slotOf, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** What an attribute holding code prints as: an undeclared name, so the pasted literal fails typecheck until the
 *  original expression is put back. */
export const KEEP = 'KEEP_FROM_SOURCE';

/**
 * The one piece of code the editor writes: what a new `action` leaf runs until someone gives it a body. It prints as
 * itself, having no place in any source to be kept from.
 */
export const STUB = (): void => {};
const STUB_TEXT = '() => {}';

const pad = (depth: number) => '  '.repeat(depth);
const isScalar = (v: unknown) => v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v);
const isPlain = isPlainObject;

/** Whether `v` is or holds something a literal cannot carry: a function, or a non-plain object. */
export function containsCode(v: unknown): boolean {
  if (typeof v === 'function') return true;
  if (Array.isArray(v)) return v.some(containsCode);
  if (v !== null && typeof v === 'object') return !isPlain(v) || Object.values(v).some(containsCode);
  return false;
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function printKey(k: string): string {
  return isValidKey(k) ? k : quote(k);
}

function printInline(v: Record<string, unknown>): string {
  const parts = Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${printKey(k)}: ${printValue(x, 0)}`);
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

/** `v` as TypeScript source, indented from `depth`. */
export function printValue(v: unknown, depth = 0): string {
  if (v === STUB) return STUB_TEXT;
  if (containsCode(v)) return KEEP;
  if (typeof v === 'string') return quote(v);
  if (isScalar(v)) return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every(isScalar)) return `[${v.map((x) => printValue(x)).join(', ')}]`;
    const rows = v.map((x) => `${pad(depth + 1)}${isPlain(x) && Object.values(x).every(isScalar) ? printInline(x) : printValue(x, depth + 1)},`);
    return `[\n${rows.join('\n')}\n${pad(depth)}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return '{}';
  const rows = entries.map(([k, x]) => `${pad(depth + 1)}${printKey(k)}: ${printValue(x, depth + 1)},`);
  return `{\n${rows.join('\n')}\n${pad(depth)}}`;
}

function printNode(node: SchemaNode, depth: number): string {
  const kids = childrenOf(node);
  const slot = slotOf(node);
  const rows = Object.entries(node as unknown as Record<string, unknown>)
    .filter(([k, x]) => x !== undefined && !(k === slot && kids))
    .map(([k, x]) => `${pad(depth + 1)}${printKey(k)}: ${printValue(x, depth + 1)},`);
  if (kids && slot === ITEM) {
    rows.push(`${pad(depth + 1)}${ITEM}: ${printNode(kids[ITEM]!, depth + 1)},`);
  } else if (kids) {
    const inner = Object.entries(kids).map(([k, c]) => `${pad(depth + 2)}${printKey(k)}: ${printNode(c, depth + 2)},`);
    rows.push(`${pad(depth + 1)}${slot}: ${inner.length ? `{\n${inner.join('\n')}\n${pad(depth + 1)}}` : '{}'},`);
  }
  return rows.length ? `{\n${rows.join('\n')}\n${pad(depth)}}` : '{}';
}

/** Code-bearing attributes print as {@link KEEP}; the tree around them prints in full. */
export function printSchema(root: SchemaRoot): string {
  return printNode(root, 0);
}

/** One difference between two schemas. A path is a node's keys from the root down, joined by `/`. */
export type SchemaChange =
  | { op: 'add'; path: string; kind: string }
  | { op: 'remove'; path: string; kind: string }
  | { op: 'move'; from: string; to: string }
  | { op: 'reorder'; path: string }
  | { op: 'attr'; path: string; key: string; from: unknown; to: unknown };

const kindOf = (n: SchemaNode) => (isPrefLeaf(n) ? n.kind : isPrefSection(n) ? 'section' : 'group');

function flatten(root: SchemaRoot): Map<string, SchemaNode> {
  const out = new Map<string, SchemaNode>();
  const walk = (node: SchemaNode, path: string | null) => {
    for (const [k, child] of Object.entries(childrenOf(node) ?? {})) {
      const p = joinPath(path, k);
      out.set(p, child);
      walk(child, p);
    }
  };
  walk(root, null);
  return out;
}

const same = (a: unknown, b: unknown) => a === b || (!containsCode(a) && !containsCode(b) && printValue(a) === printValue(b));

function attrChanges(path: string, a: SchemaNode, b: SchemaNode): SchemaChange[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const slot of ['children', 'members', 'variants', ITEM]) keys.delete(slot);
  const out: SchemaChange[] = [];
  for (const k of keys) {
    const from = (a as unknown as Record<string, unknown>)[k];
    const to = (b as unknown as Record<string, unknown>)[k];
    if (!same(from, to)) out.push({ op: 'attr', path, key: k, from, to });
  }
  return out;
}

/**
 * What changed from `before` to `after`. Nodes match by path; a node that left one path and a node with the same
 * kind and name that arrived at another are taken as one node moved, and a moved node's descendants travel with
 * it unreported. Reordering a node's children is one `reorder` for that node (`''` is the root).
 */
export function diffSchemas(before: SchemaRoot, after: SchemaRoot): SchemaChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const out: SchemaChange[] = [];
  const pairs: Array<[string, string]> = [];
  const gone = [...a.keys()].filter((p) => !b.has(p));
  const added = new Set([...b.keys()].filter((p) => !a.has(p)));
  const moved = new Map<string, string>();
  for (const from of gone.sort((x, y) => keysOf(x).length - keysOf(y).length)) {
    const via = [...moved].find(([f]) => isUnder(from, f));
    if (via) {
      const to = via[1] + from.slice(via[0].length);
      if (added.has(to)) { added.delete(to); pairs.push([from, to]); continue; }
    }
    const node = a.get(from)!;
    const to = [...added].find((p) => kindOf(b.get(p)!) === kindOf(node) && b.get(p)!.name === node.name);
    if (to === undefined) { out.push({ op: 'remove', path: from, kind: kindOf(node) }); continue; }
    added.delete(to);
    moved.set(from, to);
    out.push({ op: 'move', from, to });
    pairs.push([from, to]);
  }
  for (const p of added) out.push({ op: 'add', path: p, kind: kindOf(b.get(p)!) });
  for (const p of a.keys()) if (b.has(p)) pairs.push([p, p]);
  for (const [from, to] of pairs) out.push(...attrChanges(to, a.get(from)!, b.get(to)!));
  // Only keys present on both sides count, so a child arriving or leaving is not a reorder.
  const keysAt = (root: SchemaRoot, map: Map<string, SchemaNode>, path: string) =>
    Object.keys(childrenOf(path === '' ? root : map.get(path)!) ?? {});
  for (const p of ['', ...[...a.keys()].filter((x) => b.has(x))]) {
    const was = keysAt(before, a, p);
    const now = keysAt(after, b, p);
    const shared = (list: string[], other: string[]) => list.filter((k) => other.includes(k)).join(',');
    if (shared(was, now) !== shared(now, was)) out.push({ op: 'reorder', path: p });
  }
  out.push(...attrChanges('', before, after));
  return out;
}

/** Every path a change touches, for marking rows. */
export function changedPaths(changes: readonly SchemaChange[]): Set<string> {
  const out = new Set<string>();
  for (const c of changes) {
    if (c.op === 'move') out.add(c.to);
    else if (c.op !== 'remove') out.add(c.path);
  }
  return out;
}

function brief(v: unknown): string {
  return v === undefined ? '(unset)' : printValue(v).replace(/\s*\n\s*/g, ' ');
}

export function formatChanges(changes: readonly SchemaChange[]): string {
  return changes.map((c) => {
    switch (c.op) {
      case 'add': return `+ ${c.path}  (${c.kind})`;
      case 'remove': return `− ${c.path}  (${c.kind})`;
      case 'move': return `↕ ${c.from} → ${c.to}`;
      case 'reorder': return `⇅ ${c.path || '(root)'}  children reordered`;
      case 'attr': return `~ ${c.path ? `${c.path}.` : ''}${c.key}  ${brief(c.from)} → ${brief(c.to)}`;
    }
  }).join('\n');
}
