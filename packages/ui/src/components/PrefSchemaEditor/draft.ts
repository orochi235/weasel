import { isPlainObject, type SerializedHistory, type SerializedHistoryEntry, type SerializedOp } from '@weasel-js/core';
import { carry } from './carry';
import { isPrefLeaf, type PrefLeaf } from '@weasel-js/prefs';
import { childrenOf, joinPath, nodeAt, slotOf, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { containsCode, overridesOf, STUB } from './schemaExport';
import { findType, NO_TYPES, type PrefTypes } from './types';

/** A schema as storage can hold it, when it was saved, and the steps that led to it. */
export interface StoredDraft {
  savedAt: number;
  schema: unknown;
  /** The source the draft was an edit of, to tell the reader's changes from the source's own since. */
  source?: unknown;
  steps?: StoredSteps;
}

/**
 * Where a draft is kept: the calls of a `Storage` the editor makes. `setItem` may throw when the text is more
 * than it can hold, and is then asked again with fewer steps.
 */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A draft as an editor opens it. */
export interface OpenedDraft<R extends SchemaRoot> {
  savedAt: number;
  schema: R;
  /** The steps around it, when they were kept and still read. */
  stacks: SerializedHistory | null;
  /**
   * How the draft met the source it opens on: saved against this `same` one; `carried` onto it from another, the
   * reader's edits kept; or of a source `unknown`, when nothing can tell their edits from the source's changes.
   */
  met: 'same' | 'carried' | 'unknown';
}

/** The name of the editor's one op: a whole schema swapped for another. */
export const SWAP = 'schema.swap';

/** What a {@link SWAP} op carries: the schema it leaves and the one it makes. */
export interface SwapArgs<R extends SchemaRoot = SchemaRoot> {
  before: R;
  after: R;
}

/**
 * An editor's undo and redo steps as storage can hold them. Every step holds two whole schemas and its neighbours
 * hold the same ones, so each is written once in `schemas`, `null` standing for the source, and a step names its
 * two by index.
 */
export interface StoredSteps {
  schemas: unknown[];
  /** Which of `schemas` the editor stood on. */
  current: number;
  stacks: SerializedHistory;
}

/** How many steps back a draft keeps, and as many forward. Each costs a schema's worth of storage. */
export const STEPS_KEPT = 20;

/** Stands for an attribute that holds code: where the source schema keeps the same value. */
const FROM = '$from';
/** Stands for {@link STUB}, which no source holds. */
const NEW = '$stub';
/** Stands for a number JSON has no word for. */
const NUM = '$num';

/** Stands for a leaf made from a registered type: the type's name, beside what the leaf sets over it. */
const TYPE = '$type';
/** The attributes such a leaf has removed that its type holds. */
const UNSET = '$unset';

/** Where the source keeps a value: a node's path, then the attribute, then the keys down into it. */
type Origin = readonly [path: string | null, ...keys: string[]];

interface Packing {
  origins: Map<unknown, Origin>;
  types: PrefTypes;
}

/** The leaf a list or a map holds in `item`, which packs as a leaf of its own. */
const isEntry = (node: SchemaNode, key: string, value: unknown): value is PrefLeaf =>
  key === 'item' && isPrefLeaf(node) && (node.kind === 'list' || node.kind === 'map') && isPlainObject(value);

/** Every code-holding attribute of `root`, by the value it holds. */
function codeOrigins(root: SchemaRoot): Map<unknown, Origin> {
  const out = new Map<unknown, Origin>();
  const attrs = (node: SchemaNode, at: Origin): void => {
    for (const [key, value] of Object.entries(node)) {
      if (containsCode(value)) out.set(value, [...at, key]);
      if (isEntry(node, key, value)) attrs(value, [...at, key]);
    }
  };
  const walk = (node: SchemaNode, path: string | null): void => {
    attrs(node, [path]);
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) walk(child, joinPath(path, key));
  };
  walk(root, null);
  return out;
}

function pack(value: unknown, origins: Map<unknown, Origin>, at: Origin | null): unknown {
  if (value === STUB) return { [NEW]: true };
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

/** A node's own attributes, or a list's entry's: `at` is where the source would keep them. */
function packAttrs(node: SchemaNode, at: Origin, ctx: Packing): Record<string, unknown> {
  const type = isPrefLeaf(node) ? findType(ctx.types, node.type) : undefined;
  const attr = (key: string, value: unknown): unknown =>
    (isEntry(node, key, value) ? packAttrs(value, [...at, key], ctx) : pack(value, ctx.origins, [...at, key]));
  if (!type) return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, attr(key, value)]));
  // The type's own code needs no place in the source: it comes back with the type.
  const set = Object.entries(overridesOf(node as PrefLeaf, type));
  const unset = set.filter(([, value]) => value === undefined).map(([key]) => key);
  return {
    [TYPE]: type.type,
    kind: type.kind,
    ...Object.fromEntries(set.filter(([, value]) => value !== undefined).map(([key, value]) => [key, attr(key, value)])),
    ...(unset.length > 0 ? { [UNSET]: unset } : {}),
  };
}

function packNode(node: SchemaNode, path: string | null, ctx: Packing): unknown {
  const kids = childrenOf(node);
  const out = packAttrs(node, [path], ctx);
  if (kids) out[slotOf(node)!] = Object.fromEntries(Object.entries(kids).map(([k, child]) => [k, packNode(child, joinPath(path, k), ctx)]));
  return out;
}

/**
 * `schema` as JSON can hold it: an attribute holding code is written as where `source` keeps that value, and a
 * leaf made from one of `types` as the type's name and what the leaf sets over it.
 */
export function packDraft(schema: SchemaRoot, source: SchemaRoot, types: PrefTypes = NO_TYPES): unknown {
  return packNode(schema, null, { origins: codeOrigins(source), types });
}

/** The nearest `keep` steps each way of `stacks`, whose ops are all {@link SWAP}s, and the schema they stand on. */
export function packSteps(stacks: SerializedHistory, current: SchemaRoot, source: SchemaRoot, keep = STEPS_KEPT, types: PrefTypes = NO_TYPES): StoredSteps {
  const ctx: Packing = { origins: codeOrigins(source), types };
  const schemas: unknown[] = [];
  const seen = new Map<SchemaRoot, number>();
  const index = (schema: SchemaRoot): number => {
    const known = seen.get(schema);
    if (known !== undefined) return known;
    seen.set(schema, schemas.length);
    return schemas.push(schema === source ? null : packNode(schema, null, ctx)) - 1;
  };
  const ops = (list: readonly SerializedOp[]): SerializedOp[] => list.map((op) => {
    const { before, after } = op.args as SwapArgs;
    return { name: op.name, args: { before: index(before), after: index(after) } };
  });
  const entry = (e: SerializedHistoryEntry): SerializedHistoryEntry => ({ ...e, forwardOps: ops(e.forwardOps), baseOps: ops(e.baseOps) });
  // Both stacks end on the step nearest where the editor stands.
  const near = (list: readonly SerializedHistoryEntry[]) => (keep > 0 ? list.slice(-keep) : []).map(entry);
  return {
    current: index(current),
    stacks: { version: 1, undoStack: near(stacks.undoStack), redoStack: near(stacks.redoStack), nextEntryId: stacks.nextEntryId, droppedEntries: 0 },
    schemas,
  };
}

function unpack(value: unknown, source: SchemaRoot, types: PrefTypes): unknown {
  if (Array.isArray(value)) return value.map((v) => unpack(v, source, types));
  if (!isPlainObject(value)) return value;
  if (NUM in value) return Number(value[NUM]);
  if (NEW in value) return STUB;
  if (FROM in value) {
    const [path, ...keys] = value[FROM] as Origin;
    let held: unknown = nodeAt(source, path);
    for (const key of keys) held = (held as Record<string, unknown> | undefined)?.[key];
    return held;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === TYPE || k === UNSET) continue;
    const next = unpack(v, source, types);
    // Code the source no longer holds is dropped with its attribute, as an attribute never set.
    if (next !== undefined) out[k] = next;
  }
  if (!(TYPE in value)) return out;
  const name = value[TYPE] as string;
  // A type the host no longer registers leaves a leaf of that name, holding only what the draft set on it.
  const leaf: Record<string, unknown> = { name, description: '', default: undefined, ...findType(types, name), ...out, type: name };
  for (const key of (value[UNSET] as string[] | undefined) ?? []) delete leaf[key];
  return leaf;
}

/** The schema {@link packDraft} wrote, its code taken back from `source` and its typed leaves from `types`. */
export function unpackDraft<R extends SchemaRoot>(packed: unknown, source: R, types: PrefTypes = NO_TYPES): R {
  return unpack(packed, source, types) as R;
}

/** The steps {@link packSteps} wrote, each op holding its schemas again; `null` when they do not read as steps. */
export function unpackSteps<R extends SchemaRoot>(stored: StoredSteps, source: R, types: PrefTypes = NO_TYPES): { current: R; stacks: SerializedHistory } | null {
  try {
    const schemas = stored.schemas.map((packed) => (packed === null ? source : unpackDraft(packed, source, types)));
    const live = (i: unknown): R => {
      const schema = schemas[i as number];
      if (schema === undefined) throw new Error('no such schema');
      return schema;
    };
    const ops = (list: readonly SerializedOp[]): SerializedOp[] => list.map((op) => {
      const { before, after } = op.args as { before: number; after: number };
      return { name: op.name, args: { before: live(before), after: live(after) } satisfies SwapArgs<R> };
    });
    const entry = (e: SerializedHistoryEntry): SerializedHistoryEntry => ({ ...e, forwardOps: ops(e.forwardOps), baseOps: ops(e.baseOps) });
    const { stacks } = stored;
    return {
      current: live(stored.current),
      stacks: { ...stacks, undoStack: stacks.undoStack.map(entry), redoStack: stacks.redoStack.map(entry), branches: [] },
    };
  } catch {
    return null;
  }
}

/** The draft saved under `key`; `null` when there is none, or storage cannot be read. */
function readDraft(key: string, storage?: DraftStorage): StoredDraft | null {
  try {
    const raw = (storage ?? localStorage).getItem(key);
    const draft: unknown = raw === null ? null : JSON.parse(raw);
    return isPlainObject(draft) && typeof draft.savedAt === 'number' && isPlainObject(draft.schema) ? (draft as unknown as StoredDraft) : null;
  } catch {
    return null;
  }
}

/**
 * The draft saved under `key`, as an edit of `source`: one saved against a different source is carried onto this
 * one, so only what the reader changed still differs from it. `null` when there is no draft, storage cannot be
 * read, or carrying it leaves nothing the source does not already say; that last one is removed.
 */
export function openDraft<R extends SchemaRoot>(key: string, source: R, storage?: DraftStorage, types: PrefTypes = NO_TYPES): OpenedDraft<R> | null {
  const draft = readDraft(key, storage);
  if (!draft) return null;
  const now = JSON.parse(JSON.stringify(packDraft(source, source, types))) as unknown;
  const moved = draft.source !== undefined && JSON.stringify(draft.source) !== JSON.stringify(now);
  const onto = (packed: unknown): unknown => (moved ? carry(packed, draft.source, now) : packed);
  const schema = onto(draft.schema);
  if (moved && JSON.stringify(schema) === JSON.stringify(now)) {
    dropDraft(key, storage);
    return null;
  }
  const steps = draft.steps && unpackSteps({ ...draft.steps, schemas: draft.steps.schemas?.map((packed) => (packed === null ? null : onto(packed))) }, source, types);
  return {
    savedAt: draft.savedAt,
    schema: steps ? steps.current : unpackDraft(schema, source, types),
    stacks: steps ? steps.stacks : null,
    met: moved ? 'carried' : draft.source === undefined ? 'unknown' : 'same',
  };
}

/**
 * Save `schema` under `key` with the steps around it. A browser short of room is asked again for half the steps,
 * down to the schema alone; one that refuses storage keeps nothing.
 */
export function saveDraft(key: string, schema: SchemaRoot, source: SchemaRoot, stacks: SerializedHistory, savedAt: number, storage?: DraftStorage, types: PrefTypes = NO_TYPES): void {
  const packed = packDraft(schema, source, types);
  for (let keep = STEPS_KEPT; ; keep >>= 1) {
    const draft: StoredDraft = { savedAt, schema: packed, source: packDraft(source, source, types), ...(keep > 0 ? { steps: packSteps(stacks, schema, source, keep, types) } : {}) };
    try {
      (storage ?? localStorage).setItem(key, JSON.stringify(draft));
      return;
    } catch {
      // Private windows and full quotas throw; the editor goes on with what was kept before.
      if (keep === 0) return;
    }
  }
}

/** Remove the draft under `key`. */
export function dropDraft(key: string, storage?: DraftStorage): void {
  try {
    (storage ?? localStorage).removeItem(key);
  } catch {
    // Storage that cannot be reached holds nothing to remove.
  }
}
