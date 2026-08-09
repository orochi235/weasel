import { createContext, useContext } from 'react';
import type { Instrument } from '../instrument/types';
import type { LabMode, SavedSnapshot, WorkspaceRecord } from '../state/types';

export interface LabContextValue {
  instruments: Instrument[];
  workspaces: WorkspaceRecord[];
  addWorkspace: (instrumentName: string) => void;
  cloneWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  resetWorkspace: (id: string) => void;
  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (workspaceId: string, name?: string) => void;
  loadSnapshot: (workspaceId: string, snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  mode: LabMode;
  setMode: (m: LabMode) => void;
}

export const LabContext = createContext<LabContextValue | null>(null);

export function useLabContext(): LabContextValue {
  const ctx = useContext(LabContext);
  if (ctx === null) {
    throw new Error('useLabContext must be used inside <Lab>');
  }
  return ctx;
}
