import type { ConfigPath, ValueAtPath } from '../config/types';
import type { UndockedPanels } from './undock';
/** A trial's undo history, as snapshots of its state either side of the
 *  present. */
export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

/** The trial a per-trial call is coming from. `id` is the id `useTileId`
 *  scopes a surface tile under, so a consumer keying its own per-trial
 *  registry and labkit's tiles agree on the key. */
export interface TrialInfo<TV = unknown> {
  id: string;
  /** The trial's view, in whatever shape the instrument keeps it. */
  view: TV;
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
  /** The config `addTrial` opened this trial on, overlaid on the instrument's
   *  defaults. Kept so Reset restores the trial's own subject rather than the
   *  bare defaults. */
  configSeed?: Partial<TC>;
  /** This trial's own tool slot. Undefined means it reads the lab's. */
  activeToolId?: string | null;
  /** The extent the trial's sidebar was last dragged to, in pixels. Undefined
   *  until someone moves the seam. */
  sidebarWidth?: number;
  /** What the title bar reads. Undefined — the state a trial opens in, and the
   *  one `setTitle(null)` returns it to — means the instrument's name. */
  title?: string | null;
  /** Which of the trial's collapsible sections are folded, keyed as
   *  `TrialChromeContext.collapsedSections` describes. A key that is absent
   *  takes the section's own default. */
  collapsedSections?: Record<string, boolean>;
  /** The marks on this trial's annotation targets, as `AnnotationsApi.toJSON`
   *  wrote them. Opaque here, and absent for a trial whose instrument declares
   *  no `annotations` — or declares its own `storage`. Not in `state`, which
   *  belongs to the instrument and is typed as such. */
  annotations?: unknown;
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
  /** The lab's tool slot — what a trial with no slot of its own resolves to. */
  activeToolId: string | null;
  /** Per-trial tile extents, keyed by trial id. Opaque here — the
   *  shape belongs to whatever lays the trials out. */
  layout: Record<string, unknown>;
  /** Sidebar sections torn out of their trial. A panel here is not rendered in
   *  its trial's sidebar; the workspace renders it instead. */
  undockedPanels: UndockedPanels;
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
  /** Write one config value, by dotted path — `'grid.size'` for a leaf under
   *  an `f.group`, `'cellSize'` for one at the root. */
  setConfig: <P extends ConfigPath<TC> & string>(path: P, value: ValueAtPath<TC, P>) => void;
}

/** Options for `createLabStore`. `storageKey` namespaces the keys written, so
 *  two labs on one origin do not collide. */
export interface CreateLabStoreOptions {
  storageKey: string;
  storage: StorageAdapter;
  initialMode?: LabMode;
  /** Each instrument's default config, keyed by instrument name, used to fill
   *  the gaps in a stored one. A config saved before its schema grew a branch
   *  arrives holding that branch's defaults rather than `undefined`, and keeps
   *  whatever keys the schema has since stopped naming. `<Lab>` collects these
   *  off its `instruments`. */
  configDefaults?: Record<string, () => unknown>;
  /** How each instrument's state survives a reload. Hydration is the first
   *  thing `createLabStore` does, so these have to arrive with the store —
   *  anything registered afterwards is already too late to read the document
   *  it was built from. `<Lab>` collects them off its `instruments`. */
  serializers?: InstrumentSerializers;
}

/** Per-instrument serialize/deserialize hooks, keyed by instrument name. An
 *  instrument whose state is already JSON-safe needs no entry. `deserialize`
 *  is handed the config the state was saved against — a trial's own for a
 *  reload, the snapshot's for a load — since a state rebuilt without it can
 *  disagree with the settings sitting next to it. */
export type InstrumentSerializers = Record<
  string,
  | {
      serialize?: (state: unknown) => unknown;
      deserialize?: (data: unknown, config: unknown) => unknown;
    }
  | undefined
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
  /** Sidebar sections torn out of their trial, keyed by trial and section. */
  undockedPanels: UndockedPanels;
  mode: LabMode;
}

/** Migrates a document one version forward. Index `i` in the chain takes a
 *  version-`i` document to version `i + 1`. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
