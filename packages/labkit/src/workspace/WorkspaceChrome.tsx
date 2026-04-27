import { type KeyboardEvent, type ReactNode, useContext, useMemo } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import { useLabContext } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { WorkspaceRecord } from '../state/types';
import { DefaultSidebar } from './DefaultSidebar';
import { DefaultStatusBar } from './DefaultStatusBar';
import { DefaultToolbar } from './DefaultToolbar';
import type {
  SidebarSlot,
  StatusBarSlot,
  ToolbarSlot,
  WorkspaceSidebarContext,
  WorkspaceStatusBarContext,
  WorkspaceToolbarContext,
} from './slotTypes';

export interface WorkspaceChromeProps {
  workspaceId: string;
  record: WorkspaceRecord;
  instrument: Instrument;
  isLastWorkspace: boolean;
  toolbar?: ToolbarSlot;
  sidebar?: SidebarSlot;
  statusBar?: StatusBarSlot;
  children: ReactNode;
}

export function WorkspaceChrome({
  workspaceId,
  record,
  instrument,
  isLastWorkspace,
  toolbar,
  sidebar,
  statusBar,
  children,
}: WorkspaceChromeProps) {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] WorkspaceChrome requires <LabStoreProvider>');
  const updateWorkspaceView = useStore(storeCtx.store, (s) => s.updateWorkspaceView);

  const toolbarCtx = useMemo<WorkspaceToolbarContext>(() => {
    const setZoom = (z: number): void => {
      updateWorkspaceView(workspaceId, { ...record.view, zoom: z });
    };
    return {
      workspaceId,
      instrumentName: record.instrumentName,
      hasUndo: instrument.undo != null,
      canUndo: false,
      canRedo: false,
      undo: () => {},
      redo: () => {},
      zoom: record.view.zoom,
      setZoom,
      zoomIn: () => setZoom(record.view.zoom * 1.25),
      zoomOut: () => setZoom(record.view.zoom * 0.8),
      resetZoom: () => setZoom(1),
      hasCanvas: instrument.canvas != null,
      savedSnapshots: lab.savedSnapshots.filter((s) => s.workspaceId === workspaceId),
      saveSnapshot: (name) => lab.saveSnapshot(workspaceId, name),
      loadSnapshot: (snapshotId) => lab.loadSnapshot(workspaceId, snapshotId),
      clone: () => lab.cloneWorkspace(workspaceId),
      reset: () => lab.resetWorkspace(workspaceId),
      close: () => lab.closeWorkspace(workspaceId),
      isLastWorkspace,
    };
  }, [workspaceId, record, instrument, lab, isLastWorkspace, updateWorkspaceView]);

  const sidebarCtx = useMemo<WorkspaceSidebarContext>(
    () => ({
      workspaceId,
      instrumentName: record.instrumentName,
      configFields: instrument.configSchema?.() ?? [],
      config: record.config,
      setConfig: (_key, _value) => {
        // Plan 4 wires schema-driven config; Plan 3 leaves this as a placeholder.
      },
    }),
    [workspaceId, record, instrument],
  );

  const statusCtx: WorkspaceStatusBarContext = {
    workspaceId,
    instrumentName: record.instrumentName,
    zoom: record.view.zoom,
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) toolbarCtx.redo();
      else toolbarCtx.undo();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toolbarCtx.saveSnapshot();
    }
  };

  return (
    <section
      className="lk-workspace"
      aria-label={`Workspace ${record.instrumentName}`}
      onKeyDown={handleKeyDown}
    >
      <div className="lk-workspace__toolbar">
        {toolbar ? toolbar(toolbarCtx) : <DefaultToolbar ctx={toolbarCtx} />}
      </div>
      <div className="lk-workspace__body">
        <div className="lk-workspace__sidebar">
          {sidebar ? sidebar(sidebarCtx) : <DefaultSidebar ctx={sidebarCtx} />}
        </div>
        <div className="lk-workspace__content">{children}</div>
      </div>
      <div className="lk-workspace__status">
        {statusBar ? statusBar(statusCtx) : <DefaultStatusBar ctx={statusCtx} />}
      </div>
    </section>
  );
}
