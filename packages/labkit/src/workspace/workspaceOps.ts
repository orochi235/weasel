import type { Instrument } from '../instrument/types';
import type { WorkspaceRecord } from '../state/types';

const DEFAULT_VIEW = { zoom: 1, pan: { x: 0, y: 0 } } as const;

function findInstrument(instruments: Instrument[], name: string): Instrument {
  const found = instruments.find((i) => i.name === name);
  if (!found) {
    throw new Error(`[labkit] Unknown instrument: "${name}"`);
  }
  return found;
}

function initialView(instrument: Instrument): WorkspaceRecord['view'] {
  return instrument.canvas?.initialView
    ? structuredClone(instrument.canvas.initialView)
    : { ...DEFAULT_VIEW, pan: { ...DEFAULT_VIEW.pan } };
}

export function addWorkspace(
  workspaces: WorkspaceRecord[],
  instruments: Instrument[],
  instrumentName: string,
): WorkspaceRecord[] {
  const instrument = findInstrument(instruments, instrumentName);
  const config = instrument.defaultConfig();
  const state = instrument.initialState(config);
  const record: WorkspaceRecord = {
    id: crypto.randomUUID(),
    instrumentName,
    config,
    state,
    view: initialView(instrument),
    undoStack: { past: [], future: [] },
  };
  return [...workspaces, record];
}

export function cloneWorkspace(workspaces: WorkspaceRecord[], id: string): WorkspaceRecord[] {
  const sourceIdx = workspaces.findIndex((w) => w.id === id);
  const source = workspaces[sourceIdx];
  if (!source) return workspaces;
  const clone: WorkspaceRecord = {
    ...source,
    id: crypto.randomUUID(),
    config: structuredClone(source.config),
    state: structuredClone(source.state),
    view: structuredClone(source.view),
    undoStack: { past: [], future: [] },
  };
  return [...workspaces.slice(0, sourceIdx + 1), clone, ...workspaces.slice(sourceIdx + 1)];
}

export function closeWorkspace(workspaces: WorkspaceRecord[], id: string): WorkspaceRecord[] {
  if (workspaces.length <= 1) return workspaces;
  const next = workspaces.filter((w) => w.id !== id);
  return next.length === workspaces.length ? workspaces : next;
}

export function resetWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
  instruments: Instrument[],
): WorkspaceRecord[] {
  const idx = workspaces.findIndex((w) => w.id === id);
  const current = workspaces[idx];
  if (!current) return workspaces;
  const instrument = findInstrument(instruments, current.instrumentName);
  const config = instrument.defaultConfig();
  const state = instrument.initialState(config);
  const reset: WorkspaceRecord = {
    ...current,
    config,
    state,
    view: initialView(instrument),
  };
  return [...workspaces.slice(0, idx), reset, ...workspaces.slice(idx + 1)];
}
