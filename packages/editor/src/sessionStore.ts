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
 * to `<key>:unreadable` first, with a `console.error`, since the next save writes over `key`: like a failed
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

/** Whether `value`, the record in `slot`, is what {@link readStored} last kept aside as unreadable: a load of it fell
 *  back. */
export function keptUnreadable(slot: SessionSlot, value: unknown): boolean {
  const aside = asideOf(slot);
  return sameValue(aside.records.get(aside.name), value);
}

function keepUnreadable(slot: SessionSlot, value: unknown, err: unknown): void {
  const aside = asideOf(slot);
  if (!aside.records.writable) {
    console.error(`weasel: the entry under "${keyOf(slot)}" could not be read, and could not be kept aside`, err);
    return;
  }
  if (sameValue(aside.records.get(aside.name), value)) return;
  aside.records.set(aside.name, value);
  console.error(`weasel: the entry under "${keyOf(slot)}" could not be read; it is kept under "${keyOf(aside)}"`, err);
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
  const deps = dependents.map(([key, value]) => [slotOf(key), value] as const);
  const depSlots = deps.map(([slot]) => slot);
  const before = [doc, ...depSlots].map((slot) => [slot, stateOf(slot)] as const);
  for (const slot of depSlots) slot.records.delete(slot.name);
  if (depSlots.some((slot) => slot.records.pending(slot.name))) await flushAll(depSlots);
  doc.records.set(doc.name, primary[1]);
  if (!(await flushAll([doc]))) {
    // Put back what was there, so a retry of the write that failed never lands the document without its dependents.
    for (const [slot, was] of before) replace(slot, slot === doc ? primary[1] : ABSENT, was);
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
 * Write a document and the entries that depend on it, such as its undo stacks, best-effort. A dependent that fails to
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
