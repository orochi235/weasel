/** A workspace's undo history, as snapshots of its state either side of the
 *  present. */
export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

/** One workspace as the store holds it: which instrument it runs, that
 *  instrument's config and state, the camera, and the undo history. */
export interface WorkspaceRecord<TS = unknown, TC = unknown> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: { zoom: number; pan: { x: number; y: number } };
  undoStack: UndoStack;
}

/** A named, saved copy of a workspace's config and state, restorable into any
 *  workspace running the same instrument. */
export interface SavedSnapshot {
  id: string;
  name: string;
  workspaceId: string;
  instrumentName: string;
  config: unknown;
  state: unknown;
  savedAt: number;
}

/** `auto` follows the OS; the other two are an explicit choice. */
export type LabMode = 'auto' | 'light' | 'dark';

/** Everything a lab persists: its workspaces, its saved snapshots, and the
 *  chosen color mode. */
export interface LabStoreState {
  workspaces: WorkspaceRecord[];
  savedSnapshots: SavedSnapshot[];
  mode: LabMode;
  /** Per-workspace tile extents, keyed by workspace id. Opaque here — the
   *  shape belongs to whatever lays the workspaces out. */
  layout: Record<string, unknown>;
}

/** Where a lab persists itself. Implementations are keyed string storage and
 *  nothing more, so the same store works against localStorage, the URL hash,
 *  or memory. */
export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  delete?(key: string): void;
}

/** What `useExperimentState` hands an instrument: its state and config, with
 *  a setter for each. */
export interface ExperimentStateHandle<TS, TC> {
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  config: TC;
  setConfig: (key: keyof TC, value: TC[keyof TC]) => void;
}

/** Options for `createLabStore`. `storageKey` namespaces the keys written, so
 *  two labs on one origin do not collide. */
export interface CreateLabStoreOptions {
  storageKey: string;
  storage: StorageAdapter;
  initialMode?: LabMode;
}

/** Per-instrument serialize/deserialize hooks, keyed by instrument name. An
 *  instrument whose state is already JSON-safe needs no entry. */
export type InstrumentSerializers = Record<
  string,
  { serialize?: (state: unknown) => unknown; deserialize?: (data: unknown) => unknown } | undefined
>;

/** A workspace as it is persisted: everything but the undo history, which is
 *  session-only. */
export type SerializedTrial = Omit<WorkspaceRecord, 'undoStack'>;

/** Everything a lab persists, under one key, at a known version. */
export interface LabDocument {
  version: number;
  workspaces: SerializedTrial[];
  saves: SavedSnapshot[];
  layout: Record<string, unknown>;
  mode: LabMode;
}

/** Migrates a document one version forward. Index `i` in the chain takes a
 *  version-`i` document to version `i + 1`. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
