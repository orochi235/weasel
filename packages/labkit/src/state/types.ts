/** A trial's undo history, as snapshots of its state either side of the
 *  present. */
export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

/** One trial as the store holds it: which instrument it runs, that
 *  instrument's config and state, the camera, and the undo history. */
export interface TrialRecord<TS = unknown, TC = unknown, TV = unknown> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  /** Opaque to labkit: persisted, restored on Reset and handed to the instrument,
   *  but never read into. A 3D lab puts an orbit here and keeps all three. */
  view: TV;
  undoStack: UndoStack;
}

/** A named, saved copy of a trial's config and state, restorable into any
 *  trial running the same instrument. */
export interface SavedSnapshot {
  id: string;
  name: string;
  trialId: string;
  instrumentName: string;
  config: unknown;
  state: unknown;
  savedAt: number;
}

/** `auto` follows the OS; the other two are an explicit choice. */
export type LabMode = 'auto' | 'light' | 'dark';

/** Everything a lab persists: its trials, its saved snapshots, and the
 *  chosen color mode. */
export interface LabStoreState {
  trials: TrialRecord[];
  savedSnapshots: SavedSnapshot[];
  mode: LabMode;
  /** Per-trial tile extents, keyed by trial id. Opaque here — the
   *  shape belongs to whatever lays the trials out. */
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

/** What `useTrialState` hands an instrument: its state and config, with
 *  a setter for each. */
export interface TrialStateHandle<TS, TC> {
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

/** A trial as it is persisted: everything but the undo history, which is
 *  session-only. */
export type SerializedTrial = Omit<TrialRecord, 'undoStack'>;

/** Everything a lab persists, under one key, at a known version. */
export interface LabDocument {
  version: number;
  trials: SerializedTrial[];
  saves: SavedSnapshot[];
  layout: Record<string, unknown>;
  mode: LabMode;
}

/** Migrates a document one version forward. Index `i` in the chain takes a
 *  version-`i` document to version `i + 1`. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
