import { localStorageAdapter, openRecordsSync, type OwnedRecordCache, type RecordCache } from '@weasel-js/storage';

/** One stored entry: its key and the value it holds. A value JSON reads back as itself, so that every storage
 *  adapter keeps it exactly; core's `encodeSnapshot` makes one of a snapshot holding typed arrays. */
export type SessionEntry = readonly [key: string, value: unknown];

/** One record: the cache holding it and its name there. */
export interface SessionSlot {
  readonly records: RecordCache;
  readonly name: string;
}

/** Each key's record in `records`, or, with none, in a cache of its own over `localStorage` opened on the key's first
 *  use, its name the key. `close` closes the caches it opened. */
export interface SessionSlots {
  slot(key: string): SessionSlot;
  close(): Promise<void>;
}

export function sessionSlots(records?: RecordCache): SessionSlots {
  if (records) return { slot: (name) => ({ records, name }), close: async () => {} };
  const opened = new Map<string, OwnedRecordCache>();
  return {
    slot: (key) => {
      let local = opened.get(key);
      if (!local) {
        local = openRecordsSync({ storage: localStorageAdapter, prefix: key, retryMs: false });
        localCaches.add(local);
        opened.set(key, local);
      }
      return { records: local, name: '' };
    },
    close: async () => {
      const caches = [...opened.values()];
      opened.clear();
      await Promise.all(caches.map((c) => c.close()));
    },
  };
}

function withSlot<T>(key: string, records: RecordCache | undefined, run: (slot: SessionSlot) => T): T {
  const slots = sessionSlots(records);
  try {
    return run(slots.slot(key));
  } finally {
    void slots.close();
  }
}

/**
 * The entry under `key` read through `read`, or `fallback()` when there is none, when its records could not be read,
 * or when `read` throws on what is there. `read` is handed a copy, free to change. An entry `read` throws on is copied
 * to `<key>:unreadable`, with a `console.error`, and until that copy has landed {@link writeSession} and `useAutosave`
 * refuse to write over or remove `key`, answering false and trying the copy again on each save: like a failed
 * {@link writeSession}, a failed read does not cost the stored document. `records` is where the entries are kept, a
 * cache opened before the read; without it, `localStorage`, under `key` itself.
 */
export function readStored<T>(key: string, read: (value: unknown) => T, fallback: () => T, records?: RecordCache): T {
  return withSlot(key, records, (slot) => readSlot(slot, read, fallback));
}

/** {@link readStored} of one record. */
export function readSlot<T>(slot: SessionSlot, read: (value: unknown) => T, fallback: () => T): T {
  const { records, name } = slot;
  if (!records.has(name)) return fallback();
  const value = records.get(name);
  try {
    return read(structuredClone(value));
  } catch (err) {
    keepUnreadable(slot, value, err);
    return fallback();
  }
}

const UNREADABLE = ':unreadable';
const asideOf = ({ records, name }: SessionSlot): SessionSlot => ({ records, name: `${name}${UNREADABLE}` });
const keyOf = ({ records, name }: SessionSlot): string => `${records.prefix}${name}`;

/** Whether `key` is where {@link readStored} keeps an unreadable entry aside, not an entry of its own. */
export const isUnreadableKey = (key: string): boolean => key.endsWith(UNREADABLE);

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// The unreadable entries not yet known to be kept aside, each by the cache it was read from and its name there, and
// its value. One read through `sessionSlots`' own `localStorage` caches is held by its key, since every call opens
// caches of its own.
const localCaches = new WeakSet<RecordCache>();
const localHeld = new Map<string, unknown>();
const recordsHeld = new WeakMap<RecordCache, Map<string, unknown>>();
const heldOf = (slot: SessionSlot): { held: Map<string, unknown>; at: string } =>
  localCaches.has(slot.records)
    ? { held: localHeld, at: keyOf(slot) }
    : { held: recordsHeld.get(slot.records) ?? new Map(), at: slot.name };

function hold(slot: SessionSlot, value: unknown): void {
  const { held, at } = heldOf(slot);
  held.set(at, value);
  if (!localCaches.has(slot.records)) recordsHeld.set(slot.records, held);
}

const keptAside = (aside: SessionSlot, value: unknown): boolean =>
  !aside.records.pending(aside.name) && sameValue(aside.records.get(aside.name), value);

function keepUnreadable(slot: SessionSlot, value: unknown, err: unknown): void {
  const aside = asideOf(slot);
  if (keptAside(aside, value)) return;
  hold(slot, value);
  if (!aside.records.writable) {
    console.error(`weasel: the entry under "${keyOf(slot)}" could not be read, and could not be kept aside`, err);
    return;
  }
  if (sameValue(aside.records.get(aside.name), value)) return;
  aside.records.set(aside.name, value);
  console.error(
    `weasel: the entry under "${keyOf(slot)}" could not be read; it is being kept under "${keyOf(aside)}", and nothing is saved over it until it is`,
    err,
  );
}

/** Whether `doc` may be written: true unless it holds an entry {@link readStored} could not read whose copy aside has
 *  not landed, which is tried again here first. Answers at once, not as a promise, when nothing is held, so the save
 *  starts its write in the same tick, as one on `pagehide` must. */
function secureUnreadable(doc: SessionSlot): Promise<boolean> | true {
  const { held, at } = heldOf(doc);
  if (!held.has(at)) return true;
  const value = held.get(at);
  const aside = asideOf(doc);
  const release = (): true => {
    if (held.get(at) === value) held.delete(at);
    return true;
  };
  // Written over by someone else since: there is nothing left here to keep.
  if (!sameValue(doc.records.has(doc.name) ? doc.records.get(doc.name) : undefined, value)) return release();
  if (keptAside(aside, value)) return release();
  return (async () => {
    if (aside.records.writable && !sameValue(aside.records.get(aside.name), value)) aside.records.set(aside.name, value);
    if (aside.records.pending(aside.name)) await aside.records.flush();
    if (aside.records.writable && keptAside(aside, value)) return release();
    console.error(`weasel: the unreadable entry under "${keyOf(doc)}" could not be kept under "${keyOf(aside)}"; it is not saved over`);
    return false;
  })();
}

/** Flush the caches holding `slots`, and answer whether each slot's write landed: a write of another record in one
 *  of those caches failing does not count against them. */
async function flushAll(slots: readonly SessionSlot[]): Promise<boolean> {
  const caches = [...new Set(slots.map((s) => s.records))];
  await Promise.all(caches.map((c) => c.flush()));
  return slots.every(({ records, name }) => records.writable && !records.pending(name));
}

const ABSENT = Symbol('absent');
const stateOf = ({ records, name }: SessionSlot): unknown => (records.has(name) ? records.get(name) : ABSENT);

/** Set `slot` to `next`, `ABSENT` to delete, unless something has changed it since it was left at `left`: a later
 *  save's value is never written over with an older one. */
function replace(slot: SessionSlot, left: unknown, next: unknown): void {
  if (stateOf(slot) !== left) return;
  if (next === ABSENT) slot.records.delete(slot.name);
  else slot.records.set(slot.name, next);
}

/**
 * {@link writeSession} into the records `slotOf` names for each key. The dependents are removed before the document
 * is written and written once it has landed, so storage that writes each record on its own, as IndexedDB does, never
 * holds a dependent beside a document it was not saved with, even when the page goes away partway.
 */
export async function writeSlots(
  slotOf: (key: string) => SessionSlot,
  primary: SessionEntry,
  dependents: readonly SessionEntry[] = [],
): Promise<boolean> {
  const doc = slotOf(primary[0]);
  if (!doc.records.writable) return false;
  const secured = secureUnreadable(doc);
  if (secured !== true && !(await secured)) return false;
  const deps = dependents.map(([key, value]) => [slotOf(key), value] as const);
  const depSlots = deps.map(([slot]) => slot);
  const before = [doc, ...depSlots].map((slot) => [slot, stateOf(slot)] as const);
  for (const slot of depSlots) slot.records.delete(slot.name);
  if (depSlots.some((slot) => slot.records.pending(slot.name))) await flushAll(depSlots);
  const next = primary[1] === undefined ? ABSENT : primary[1];
  replace(doc, stateOf(doc), next);
  if (!(await flushAll([doc]))) {
    // Put back what was there, so a retry of the write that failed never lands the document without its dependents.
    for (const [slot, was] of before) replace(slot, slot === doc ? next : ABSENT, was);
    await flushAll([doc, ...depSlots]);
    return false;
  }
  if (deps.length === 0) return true;
  for (const [slot, value] of deps) replace(slot, ABSENT, value);
  if (!(await flushAll(depSlots))) {
    for (const [slot, value] of deps) replace(slot, value, ABSENT);
    await flushAll(depSlots);
  }
  return true;
}

/**
 * Write a document and the entries that depend on it, such as its undo stacks, best-effort. A document value of
 * `undefined` removes the document. One {@link readStored} could not read is neither written over nor removed until
 * its copy aside has landed. A dependent that fails to
 * save after its document did is removed along with the other dependents, because an older undo stack would replay
 * against the wrong document. When the document itself fails, the previous document and its dependents are put back
 * as they were. Resolves whether the document was saved. `records` is where the entries are kept; without it,
 * `localStorage`, under the keys themselves.
 */
export async function writeSession(
  primary: SessionEntry,
  dependents: readonly SessionEntry[] = [],
  records?: RecordCache,
): Promise<boolean> {
  const slots = sessionSlots(records);
  try {
    return await writeSlots(slots.slot, primary, dependents);
  } finally {
    await slots.close();
  }
}
