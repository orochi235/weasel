import { ownAt } from '../config/path';
import { savedTrialHistory } from './savedUndo';
import type { InstrumentSerializers, SerializedTrial, TrialRecord } from './types';

/** The storage key a lab writes one of its buckets under. Namespaced by
 *  `storageKey` so two labs sharing an origin do not collide. */
export function labStorageKey(
  storageKey: string,
  bucket: 'workspaces' | 'saves' | 'theme' | 'layout',
): string {
  return `lk:${storageKey}:${bucket}`;
}

/**
 * An id for a trial or a snapshot.
 *
 * `crypto.randomUUID` exists only in a secure context, and a LAN address is
 * not one — so a lab opened on a phone or a tablet by IP throws on its first
 * render and shows a blank page with nothing in reach to say why. The counter
 * is per page load, which is all these ids have to survive: they name records
 * inside one session's store, and a saved snapshot carries its own name.
 */
let idCounter = 0;
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `lk-${Date.now().toString(36)}-${idCounter++}`;
}

/** Serialize trials for storage, running each instrument's own serializer
 *  over its state. A trial's undo history goes with it, or, before the trial
 *  has restored one, the undo its record was read with. `own` answers for the
 *  history an instrument keeps itself, as `ownUndoOf` does. */
export function serializeTrials(
  trials: TrialRecord[],
  serializers: InstrumentSerializers,
  own: (trialId: string) => { data: unknown } | undefined = () => undefined,
): SerializedTrial[] {
  return trials.map(({ history, undo, ...w }) => {
    const s = ownAt(serializers, w.instrumentName);
    const trial = history ? savedTrialHistory(history, s) : undo?.trial;
    const mine = own(w.id);
    const ownData = mine ? mine.data : undo?.own;
    const saved = {
      ...(trial ? { trial } : {}),
      ...(ownData !== undefined ? { own: ownData } : {}),
    };
    return {
      ...w,
      state: s?.serialize ? s.serialize(w.state) : w.state,
      ...(trial || ownData !== undefined ? { undo: saved } : {}),
    };
  });
}

/** Rebuild trials from storage, running each instrument's deserializer
 *  over its state. Each keeps the undo it was saved with, for the trial to
 *  restore once it mounts. Input that is not an array yields an empty list. */
export function deserializeTrials(
  records: SerializedTrial[],
  deserializers: InstrumentSerializers,
): TrialRecord[] {
  if (!Array.isArray(records)) {
    console.warn('[labkit] deserializeTrials: not an array, returning empty list');
    return [];
  }
  return records.map((r) => {
    const d = ownAt(deserializers, r.instrumentName);
    return {
      ...r,
      state: d?.deserialize ? d.deserialize(r.state, r.config) : r.state,
    };
  });
}
