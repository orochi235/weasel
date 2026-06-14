import type { InstrumentSerializers, UndoStack, WorkspaceRecord } from './types';

export function labStorageKey(
  storageKey: string,
  bucket: 'workspaces' | 'saves' | 'theme',
): string {
  return `lk:${storageKey}:${bucket}`;
}

export function encodeUrlHash(value: string): string {
  return btoa(encodeURIComponent(value));
}

export function decodeUrlHash(hash: string): string | null {
  if (!hash) return null;
  try {
    return decodeURIComponent(atob(hash));
  } catch {
    return null;
  }
}

export function emptyUndoStack(): UndoStack {
  return { past: [], future: [] };
}

type SerializedRecord = Omit<WorkspaceRecord, 'undoStack'>;

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
