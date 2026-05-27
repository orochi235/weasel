export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

export interface WorkspaceRecord<TS = unknown, TC = unknown> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: { zoom: number; pan: { x: number; y: number } };
  undoStack: UndoStack;
}

export interface SavedSnapshot {
  id: string;
  name: string;
  workspaceId: string;
  instrumentName: string;
  config: unknown;
  state: unknown;
  savedAt: number;
}

export interface LabStoreState {
  workspaces: WorkspaceRecord[];
  savedSnapshots: SavedSnapshot[];
  theme: 'light' | 'interstellar' | 'auto';
}

export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  delete?(key: string): void;
}

export interface ExperimentStateHandle<TS, TC> {
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  config: TC;
  setConfig: (key: keyof TC, value: TC[keyof TC]) => void;
}

export interface CreateLabStoreOptions {
  storageKey: string;
  storage: StorageAdapter;
  initialTheme?: 'light' | 'interstellar' | 'auto';
}

export type InstrumentSerializers = Record<
  string,
  { serialize?: (state: unknown) => unknown; deserialize?: (data: unknown) => unknown } | undefined
>;
