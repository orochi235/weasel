import { useContext } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument, RenderContext } from '../instrument/types';
import { useLabContext } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { WorkspaceChrome } from './WorkspaceChrome';

export interface WorkspaceProps {
  id: string;
}

export function Workspace({ id }: WorkspaceProps) {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] <Workspace> requires <LabStoreProvider>');

  const record = useStore(storeCtx.store, (s) => s.workspaces.find((w) => w.id === id));
  const updateWorkspaceState = useStore(storeCtx.store, (s) => s.updateWorkspaceState);
  const updateWorkspaceConfig = useStore(storeCtx.store, (s) => s.updateWorkspaceConfig);
  const updateWorkspaceView = useStore(storeCtx.store, (s) => s.updateWorkspaceView);

  if (!record) {
    return <div className="lk-workspace lk-workspace--unknown">Workspace not found: {id}</div>;
  }

  const instrument = lab.instruments.find((i) => i.name === record.instrumentName);
  if (!instrument) {
    return (
      <div className="lk-workspace lk-workspace--unknown">
        Unknown instrument: {record.instrumentName}
      </div>
    );
  }

  const renderCtx: RenderContext<unknown, unknown> = {
    state: record.state,
    config: record.config,
    setState: (next) => updateWorkspaceState(record.id, next),
    setConfig: (key, value) => updateWorkspaceConfig(record.id, key as never, value as never),
    workspace: {
      id: record.id,
      zoom: record.view.zoom,
      setZoom: (z) => updateWorkspaceView(record.id, { ...record.view, zoom: z }),
    },
    emit: () => {
      // Plan 5 wires the system event bus; Plan 3 stub no-ops.
    },
  };

  const isLast = lab.workspaces.length <= 1;

  return (
    <WorkspaceChrome
      workspaceId={record.id}
      record={record}
      instrument={instrument as Instrument}
      isLastWorkspace={isLast}
    >
      {instrument.render(renderCtx)}
    </WorkspaceChrome>
  );
}
