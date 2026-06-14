import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { LabStoreContext, WorkspaceIdContext } from './context';
import type { ExperimentStateHandle } from './types';

export function useExperimentState<TS = unknown, TC = unknown>(): ExperimentStateHandle<TS, TC> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useExperimentState must be used inside <LabStoreProvider>');

  const workspaceId = useContext(WorkspaceIdContext);
  if (!workspaceId)
    throw new Error('[labkit] useExperimentState must be used inside <WorkspaceIdProvider>');

  const record = useStore(ctx.store, (s) => s.workspaces.find((w) => w.id === workspaceId));

  if (!record) throw new Error(`[labkit] No workspace found with id "${workspaceId}"`);

  const updateWorkspaceState = useStore(ctx.store, (s) => s.updateWorkspaceState);
  const updateWorkspaceConfig = useStore(ctx.store, (s) => s.updateWorkspaceConfig);

  return {
    state: record.state as TS,
    config: record.config as TC,
    setState: (next) =>
      updateWorkspaceState(workspaceId, next as Parameters<typeof updateWorkspaceState>[1]),
    setConfig: (key, value) => updateWorkspaceConfig(workspaceId, key as never, value as never),
  };
}
