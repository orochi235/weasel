import type { RecordCache } from '@weasel-js/storage';
import { CURRENT_DOCUMENT_VERSION } from './document';
import {
  compareTrialOrder,
  LAYOUT_RECORD,
  type LabMeta,
  META_RECORD,
  saveRecord,
  trialRecord,
  trialValuesPrefix,
  UNDOCK_RECORD,
} from './labRecords';
import type { LabMode, LabStoreState, SavedSnapshot, TrialRecord, UnreadableRecord } from './types';

/** What a lab store holds that its records keep. */
export type PersistedState = Pick<
  LabStoreState,
  'trials' | 'savedSnapshots' | 'unreadable' | 'layout' | 'undockedPanels' | 'mode'
>;

/** What the store holds that the records do not, when a store is bound to them. */
export interface UnsavedState {
  trials: readonly string[];
  saves: readonly string[];
  layout: boolean;
  undock: boolean;
  mode: boolean;
}

/** The order a trial added after every one in `orders` takes. */
export function nextOrderIn(orders: ReadonlyMap<string, number>): number {
  let max = -1;
  for (const order of orders.values()) max = Math.max(max, order);
  return max + 1;
}

function writeMeta(records: RecordCache, mode: LabMode): void {
  records.set(META_RECORD, { version: CURRENT_DOCUMENT_VERSION, mode } satisfies LabMeta);
}

function deleteTrialRecords(records: RecordCache, id: string): void {
  records.delete(trialRecord(id));
  for (const [name] of records.entries(trialValuesPrefix(id))) records.delete(name);
}

function persistedFieldsDiffer(a: TrialRecord, b: TrialRecord): boolean {
  if (a === b) return false;
  const fields = [...Object.keys(a), ...Object.keys(b)] as (keyof TrialRecord)[];
  for (const key of new Set(fields)) {
    if (key !== 'history' && !Object.is(a[key], b[key])) return true;
  }
  return false;
}

function inOrder(trials: TrialRecord[], orderOf: ReadonlyMap<string, number>): boolean {
  for (let i = 1; i < trials.length; i++) {
    const a = trials[i - 1] as TrialRecord;
    const b = trials[i] as TrialRecord;
    const at = { trial: a, order: orderOf.get(a.id) ?? 0 };
    const bt = { trial: b, order: orderOf.get(b.id) ?? 0 };
    if (compareTrialOrder(at, bt) >= 0) return false;
  }
  return true;
}

/** Delete the records of what left `was` for `now`: each one was discarded. */
function deleteDiscarded(
  records: RecordCache,
  now: UnreadableRecord[],
  was: UnreadableRecord[],
): boolean {
  const gone = now === was ? [] : was.filter((u) => !now.includes(u));
  for (const { kind, id } of gone) {
    if (kind === 'trial') deleteTrialRecords(records, id);
    else records.delete(saveRecord(id));
  }
  return gone.length > 0;
}

/** Write the trials that changed from `was` to `now`, and delete those gone; returns whether anything was written. */
function writeTrialChanges(
  records: RecordCache,
  now: TrialRecord[],
  was: TrialRecord[],
  orderOf: Map<string, number>,
  writeTrial: (trial: TrialRecord) => void,
): boolean {
  let wrote = false;
  const before = new Map(was.map((t) => [t.id, t]));
  const kept = new Set(now.map((t) => t.id));
  for (const t of was) {
    if (kept.has(t.id)) continue;
    deleteTrialRecords(records, t.id);
    orderOf.delete(t.id);
    wrote = true;
  }
  const added = now.filter((t) => !before.has(t.id));
  for (const t of added) orderOf.set(t.id, nextOrderIn(orderOf));
  if (inOrder(now, orderOf)) {
    for (const t of now) {
      const old = before.get(t.id);
      if (old && !persistedFieldsDiffer(old, t)) continue;
      writeTrial(t);
      wrote = true;
    }
  } else {
    // A reorder, or a trial inserted mid-list: renumber them all.
    for (const [i, t] of now.entries()) orderOf.set(t.id, i);
    for (const t of now) writeTrial(t);
    wrote = true;
  }
  return wrote;
}

/** Write the snapshots that changed from `was` to `now`, and delete those gone; returns whether anything was
 *  written. */
function writeSnapshotChanges(
  records: RecordCache,
  now: SavedSnapshot[],
  was: SavedSnapshot[],
): boolean {
  let wrote = false;
  const before = new Map(was.map((s) => [s.id, s]));
  const kept = new Set(now.map((s) => s.id));
  for (const s of now) {
    if (before.get(s.id) === s) continue;
    records.set(saveRecord(s.id), s);
    wrote = true;
  }
  for (const s of was) {
    if (kept.has(s.id)) continue;
    records.delete(saveRecord(s.id));
    wrote = true;
  }
  return wrote;
}

/** Write to `records` what changed in the store from `prev` to `state`. */
export function writeStoreChanges(
  records: RecordCache,
  state: PersistedState,
  prev: PersistedState,
  orderOf: Map<string, number>,
  writeTrial: (trial: TrialRecord) => void,
): void {
  let wrote = deleteDiscarded(records, state.unreadable, prev.unreadable);
  if (state.trials !== prev.trials) {
    wrote = writeTrialChanges(records, state.trials, prev.trials, orderOf, writeTrial) || wrote;
  }
  if (state.savedSnapshots !== prev.savedSnapshots) {
    wrote = writeSnapshotChanges(records, state.savedSnapshots, prev.savedSnapshots) || wrote;
  }
  if (state.layout !== prev.layout) {
    records.set(LAYOUT_RECORD, state.layout);
    wrote = true;
  }
  if (state.undockedPanels !== prev.undockedPanels) {
    records.set(UNDOCK_RECORD, state.undockedPanels);
    wrote = true;
  }
  if (state.mode !== prev.mode || (wrote && !records.has(META_RECORD))) {
    writeMeta(records, state.mode);
  }
}

/** Write to `records` what `state` holds that they do not. */
export function writeUnsaved(
  records: RecordCache,
  state: PersistedState,
  unsaved: UnsavedState,
  orderOf: Map<string, number>,
  writeTrial: (trial: TrialRecord) => void,
): void {
  let wrote = unsaved.layout || unsaved.undock;
  for (const t of state.trials) {
    if (!unsaved.trials.includes(t.id)) continue;
    orderOf.set(t.id, nextOrderIn(orderOf));
    writeTrial(t);
    wrote = true;
  }
  for (const s of state.savedSnapshots) {
    if (!unsaved.saves.includes(s.id)) continue;
    records.set(saveRecord(s.id), s);
    wrote = true;
  }
  if (unsaved.layout) records.set(LAYOUT_RECORD, state.layout);
  if (unsaved.undock) records.set(UNDOCK_RECORD, state.undockedPanels);
  if (unsaved.mode || (wrote && !records.has(META_RECORD))) writeMeta(records, state.mode);
}
