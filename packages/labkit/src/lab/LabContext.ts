import { createContext, useContext } from 'react';
import type { InstrumentList } from '../instrument/types';
import type { LabMode, SavedSnapshot, WorkspaceRecord } from '../state/types';

/** Lab-wide state and commands: the available instruments, the open
 *  workspaces and the operations over them, saved snapshots, and the color
 *  mode. */
export interface LabContextValue {
  instruments: InstrumentList;
  workspaces: WorkspaceRecord[];
  addWorkspace: (instrumentName: string) => void;
  cloneWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  resetWorkspace: (id: string) => void;
  reorderWorkspaces: (ids: readonly string[]) => void;
  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (workspaceId: string, name?: string) => void;
  loadSnapshot: (workspaceId: string, snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  mode: LabMode;
  setMode: (m: LabMode) => void;
}

/** Context carrying the surrounding lab. Prefer `useLabContext`. */
export const LabContext = createContext<LabContextValue | null>(null);

/** The surrounding lab. Throws outside a `<Lab>`. */
export function useLabContext(): LabContextValue {
  const ctx = useContext(LabContext);
  if (ctx === null) {
    throw new Error('useLabContext must be used inside <Lab>');
  }
  return ctx;
}
