import { isPlainObject, type SerializedHistory, type SerializedHistoryEntry, type SerializedOp } from '@weasel-js/core';
import { carry } from './carry';
import { childrenOf, ITEM, joinPath, nodeAt, slotOf, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { containsCode } from './schemaExport';

/** A schema as storage can hold it, when it was saved, and the steps that led to it. */
export interface StoredDraft {
  savedAt: number;
  schema: unknown;
  /** The source the draft was an edit of, to tell the reader's changes from the source's own since. */
  source?: unknown;
  steps?: StoredSteps;
}

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
  const slot = slotOf(node);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!kids || key !== slot) out[key] = pack(value, origins, [path, key]);
    else if (slot === ITEM) out[key] = packNode(kids[ITEM]!, joinPath(path, ITEM), origins);
    else out[key] = Object.fromEntries(Object.entries(kids).map(([k, child]) => [k, packNode(child, joinPath(path, k), origins)]));
  }
  return out;
}

/** `schema` as JSON can hold it: an attribute holding code is written as where `source` keeps that value. */
export function packDraft(schema: SchemaRoot, source: SchemaRoot): unknown {
  return packNode(schema, null, codeOrigins(source));
}

/** The nearest `keep` steps each way of `stacks`, whose ops are all {@link SWAP}s, and the schema they stand on. */
export function packSteps(stacks: SerializedHistory, current: SchemaRoot, source: SchemaRoot, keep = STEPS_KEPT): StoredSteps {
  const origins = codeOrigins(source);
  const schemas: unknown[] = [];
  const seen = new Map<SchemaRoot, number>();
  const index = (schema: SchemaRoot): number => {
    const known = seen.get(schema);
    if (known !== undefined) return known;
    seen.set(schema, schemas.length);
    return schemas.push(schema === source ? null : packNode(schema, null, origins)) - 1;
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

/** The steps {@link packSteps} wrote, each op holding its schemas again; `null` when they do not read as steps. */
export function unpackSteps<R extends SchemaRoot>(stored: StoredSteps, source: R): { current: R; stacks: SerializedHistory } | null {
  try {
    const schemas = stored.schemas.map((packed) => (packed === null ? source : unpackDraft(packed, source)));
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
function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
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
export function openDraft<R extends SchemaRoot>(key: string, source: R): OpenedDraft<R> | null {
  const draft = readDraft(key);
  if (!draft) return null;
  const now = JSON.parse(JSON.stringify(packDraft(source, source))) as unknown;
  const moved = draft.source !== undefined && JSON.stringify(draft.source) !== JSON.stringify(now);
  const onto = (packed: unknown): unknown => (moved ? carry(packed, draft.source, now) : packed);
  const schema = onto(draft.schema);
  if (moved && JSON.stringify(schema) === JSON.stringify(now)) {
    dropDraft(key);
    return null;
  }
  const steps = draft.steps && unpackSteps({ ...draft.steps, schemas: draft.steps.schemas?.map((packed) => (packed === null ? null : onto(packed))) }, source);
  return {
    savedAt: draft.savedAt,
    schema: steps ? steps.current : unpackDraft(schema, source),
    stacks: steps ? steps.stacks : null,
    met: moved ? 'carried' : draft.source === undefined ? 'unknown' : 'same',
  };
}

/**
 * Save `schema` under `key` with the steps around it. A browser short of room is asked again for half the steps,
 * down to the schema alone; one that refuses storage keeps nothing.
 */
export function saveDraft(key: string, schema: SchemaRoot, source: SchemaRoot, stacks: SerializedHistory, savedAt: number): void {
  const packed = packDraft(schema, source);
  for (let keep = STEPS_KEPT; ; keep >>= 1) {
    const draft: StoredDraft = { savedAt, schema: packed, source: packDraft(source, source), ...(keep > 0 ? { steps: packSteps(stacks, schema, source, keep) } : {}) };
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      return;
    } catch {
      // Private windows and full quotas throw; the editor goes on with what was kept before.
      if (keep === 0) return;
    }
  }
}

/** Remove the draft under `key`. */
export function dropDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage that cannot be reached holds nothing to remove.
  }
}
