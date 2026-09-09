import type { InstrumentSerializers, SerializedTrial, TrialRecord, UndoStack } from './types';

/** The storage key a lab writes one of its buckets under. Namespaced by
 *  `storageKey` so two labs sharing an origin do not collide. */
export function labStorageKey(
  storageKey: string,
  bucket: 'workspaces' | 'saves' | 'theme' | 'layout',
): string {
  return `lk:${storageKey}:${bucket}`;
}

/** Encode a string for the URL fragment. */
export function encodeUrlHash(value: string): string {
  return btoa(encodeURIComponent(value));
}

/** Decode a URL fragment written by `encodeUrlHash`, or `null` if it is
 *  malformed. */
export function decodeUrlHash(hash: string): string | null {
  if (!hash) return null;
  try {
    return decodeURIComponent(atob(hash));
  } catch {
    return null;
  }
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

/** A fresh, empty undo history. */
export function emptyUndoStack(): UndoStack {
  return { past: [], future: [] };
}

/** Serialize trials for storage, running each instrument's own serializer
 *  over its state. Undo history is deliberately dropped — it does not survive
 *  a reload. */
export function serializeTrials(
  trials: TrialRecord[],
  serializers: InstrumentSerializers,
): SerializedTrial[] {
  return trials.map(({ undoStack: _undo, ...w }) => {
    const s = serializers[w.instrumentName];
    return { ...w, state: s?.serialize ? s.serialize(w.state) : w.state };
  });
}

/** Rebuild trials from storage, running each instrument's deserializer
 *  over its state and starting each with an empty undo history. Returns an
 *  empty list rather than throwing on malformed input. */
export function deserializeTrials(
  records: SerializedTrial[],
  deserializers: InstrumentSerializers,
): TrialRecord[] {
  if (!Array.isArray(records)) {
    console.warn('[labkit] deserializeTrials: not an array, returning empty list');
    return [];
  }
  return records.map((r) => {
    const d = deserializers[r.instrumentName];
    return {
      ...r,
      state: d?.deserialize ? d.deserialize(r.state, r.config) : r.state,
      undoStack: emptyUndoStack(),
    };
  });
}
