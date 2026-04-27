import { createContext, type ReactElement, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand/react';
import type { LabStore } from './store';
import type { LabStoreState } from './types';

type LabStoreCtx = { store: LabStore } | null;

export const LabStoreContext = createContext<LabStoreCtx>(null);

export function LabStoreProvider({
  store,
  children,
}: {
  store: LabStore;
  children: ReactNode;
}): ReactElement {
  return <LabStoreContext.Provider value={{ store }}>{children}</LabStoreContext.Provider>;
}

export function useLabStore(): LabStoreState & ReturnType<LabStore['getState']> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useLabStore must be used inside <LabStoreProvider>');
  return useStore(ctx.store);
}

export const WorkspaceIdContext = createContext<string | null>(null);

export function WorkspaceIdProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}): ReactElement {
  return <WorkspaceIdContext.Provider value={workspaceId}>{children}</WorkspaceIdContext.Provider>;
}

export function useWorkspaceId(): string {
  const id = useContext(WorkspaceIdContext);
  if (!id) throw new Error('[labkit] useWorkspaceId must be used inside <WorkspaceIdProvider>');
  return id;
}
