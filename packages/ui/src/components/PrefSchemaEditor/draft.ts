import { isPlainObject } from '@weasel-js/core';
import { childrenOf, joinPath, nodeAt, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { containsCode } from './schemaExport';

/** A schema as storage can hold it, and when it was saved. */
export interface StoredDraft {
  savedAt: number;
  schema: unknown;
}

/** Stands for an attribute that holds code: where the source schema keeps the same value. */
const FROM = '$from';
/** Stands for a number JSON has no word for. */
const NUM = '$num';

type Origin = readonly [path: string | null, attribute: string];

/** Every code-holding attribute of `root`, by the value it holds. */
function codeOrigins(root: SchemaRoot): Map<unknown, Origin> {
  const out = new Map<unknown, Origin>();
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, value] of Object.entries(node)) if (containsCode(value)) out.set(value, [path, key]);
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) walk(child, joinPath(path, key));
  };
  walk(root, null);
  return out;
}

function pack(value: unknown, origins: Map<unknown, Origin>, at: Origin | null): unknown {
  if (containsCode(value)) {
    // An attribute keeps its value's identity through every edit beside it, so the value finds its place in the
    // source wherever its node has moved to. One rebuilt since falls back to the place it sits now.
    const origin = origins.get(value) ?? at;
    return origin ? { [FROM]: origin } : undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return { [NUM]: String(value) };
  if (Array.isArray(value)) return value.map((v) => pack(v, origins, null));
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pack(v, origins, null)]));
  return value;
}

function packNode(node: SchemaNode, path: string | null, origins: Map<unknown, Origin>): unknown {
  const kids = childrenOf(node);
  const slot = 'members' in node ? 'members' : 'children';
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = kids && key === slot
      ? Object.fromEntries(Object.entries(kids).map(([k, child]) => [k, packNode(child, joinPath(path, k), origins)]))
      : pack(value, origins, [path, key]);
  }
  return out;
}

/** `schema` as JSON can hold it: an attribute holding code is written as where `source` keeps that value. */
export function packDraft(schema: SchemaRoot, source: SchemaRoot): unknown {
  return packNode(schema, null, codeOrigins(source));
}

function unpack(value: unknown, source: SchemaRoot): unknown {
  if (Array.isArray(value)) return value.map((v) => unpack(v, source));
  if (!isPlainObject(value)) return value;
  if (NUM in value) return Number(value[NUM]);
  if (FROM in value) {
    const [path, attribute] = value[FROM] as Origin;
    return (nodeAt(source, path) as Record<string, unknown> | undefined)?.[attribute];
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const next = unpack(v, source);
    // Code the source no longer holds is dropped with its attribute, as an attribute never set.
    if (next !== undefined) out[k] = next;
  }
  return out;
}

/** The schema {@link packDraft} wrote, its code taken back from `source`. */
export function unpackDraft<R extends SchemaRoot>(packed: unknown, source: R): R {
  return unpack(packed, source) as R;
}

/** The draft saved under `key`; `null` when there is none, or storage cannot be read. */
export function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    const draft: unknown = raw === null ? null : JSON.parse(raw);
    return isPlainObject(draft) && typeof draft.savedAt === 'number' && isPlainObject(draft.schema) ? (draft as unknown as StoredDraft) : null;
  } catch {
    return null;
  }
}

/** Save `draft` under `key`, or with `null` remove what is there. A browser that refuses storage keeps nothing. */
export function writeDraft(key: string, draft: StoredDraft | null): void {
  try {
    if (draft === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Private windows and full quotas throw; the editor goes on without a draft.
  }
}
