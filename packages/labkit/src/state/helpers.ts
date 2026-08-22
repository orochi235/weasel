import type { InstrumentSerializers, UndoStack, WorkspaceRecord } from './types';

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

/** A fresh, empty undo history. */
export function emptyUndoStack(): UndoStack {
  return { past: [], future: [] };
}

type SerializedRecord = Omit<WorkspaceRecord, 'undoStack'>;

/** Serialize workspaces for storage, running each instrument's own serializer
 *  over its state. Undo history is deliberately dropped — it does not survive
 *  a reload. */
export function serializeWorkspaces(
  workspaces: WorkspaceRecord[],
  serializers: InstrumentSerializers,
): string {
  const records: SerializedRecord[] = workspaces.map(({ undoStack: _undo, ...w }) => {
    const s = serializers[w.instrumentName];
    return {
      ...w,
      state: s?.serialize ? s.serialize(w.state) : w.state,
    };
  });
  return JSON.stringify(records);
}

/** Rebuild workspaces from storage, running each instrument's deserializer
 *  over its state and starting each with an empty undo history. Returns an
 *  empty list rather than throwing on malformed input. */
export function deserializeWorkspaces(
  raw: string,
  deserializers: InstrumentSerializers,
): WorkspaceRecord[] {
  try {
    const records = JSON.parse(raw) as SerializedRecord[];
    return records.map((r) => {
      const d = deserializers[r.instrumentName];
      return {
        ...r,
        state: d?.deserialize ? d.deserialize(r.state) : r.state,
        undoStack: emptyUndoStack(),
      };
    });
  } catch {
    console.warn('[labkit] deserializeWorkspaces: failed to parse, returning empty list');
    return [];
  }
}
