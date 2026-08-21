import { createContext, type ReactElement, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand/react';
import type { LabStore } from './store';
import type { LabStoreState } from './types';

type LabStoreCtx = { store: LabStore } | null;

/** Context carrying the lab store. Prefer `useLabStore`; this is exported for
 *  code that needs to read the context without subscribing. */
export const LabStoreContext = createContext<LabStoreCtx>(null);

/** Provides a lab store to its subtree. */
export function LabStoreProvider({
  store,
  children,
}: {
  store: LabStore;
  children: ReactNode;
}): ReactElement {
  return <LabStoreContext.Provider value={{ store }}>{children}</LabStoreContext.Provider>;
}

/** Subscribe to the whole lab store. Throws outside a `<LabStoreProvider>`. */
export function useLabStore(): LabStoreState & ReturnType<LabStore['getState']> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useLabStore must be used inside <LabStoreProvider>');
  return useStore(ctx.store);
}

/** Context carrying which workspace the subtree belongs to. */
export const WorkspaceIdContext = createContext<string | null>(null);

/** Names the workspace its subtree belongs to, so an instrument's hooks can
 *  find their own record in the store without being passed an id. */
export function WorkspaceIdProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}): ReactElement {
  return <WorkspaceIdContext.Provider value={workspaceId}>{children}</WorkspaceIdContext.Provider>;
}

/** The id of the workspace this component is inside. Throws outside a
 *  `<WorkspaceIdProvider>`. */
export function useWorkspaceId(): string {
  const id = useContext(WorkspaceIdContext);
  if (!id) throw new Error('[labkit] useWorkspaceId must be used inside <WorkspaceIdProvider>');
  return id;
}
