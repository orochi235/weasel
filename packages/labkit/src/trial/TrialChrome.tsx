import { type KeyboardEvent, type ReactNode, useContext, useMemo } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import { useLabContext } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { TrialRecord } from '../state/types';
import { DefaultSidebar } from './DefaultSidebar';
import { DefaultStatusBar } from './DefaultStatusBar';
import { DefaultToolbar } from './DefaultToolbar';
import type {
  SidebarSlot,
  StatusBarSlot,
  ToolbarSlot,
  TrialSidebarContext,
  TrialStatusBarContext,
  TrialToolbarContext,
} from './slotTypes';

export interface UndoBindings {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** Props for `<TrialChrome>`. */
export interface TrialChromeProps {
  trialId: string;
  record: TrialRecord;
  instrument: Instrument;
  isLastTrial: boolean;
  toolbar?: ToolbarSlot;
  sidebar?: SidebarSlot;
  statusBar?: StatusBarSlot;
  undoBindings?: UndoBindings;
  sidebarExtras?: ReactNode;
  children: ReactNode;
}

/** The frame around a running instrument — toolbar, sidebar, status bar —
 *  each replaceable by a slot. Assembles the slot contexts and wires the undo
 *  keyboard shortcuts. */
export function TrialChrome({
  trialId,
  record,
  instrument,
  isLastTrial,
  toolbar,
  sidebar,
  statusBar,
  undoBindings,
  sidebarExtras,
  children,
}: TrialChromeProps) {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] TrialChrome requires <LabStoreProvider>');
  const updateTrialView = useStore(storeCtx.store, (s) => s.updateTrialView);
  const updateTrialConfig = useStore(storeCtx.store, (s) => s.updateTrialConfig);
  const updateTrialState = useStore(storeCtx.store, (s) => s.updateTrialState);

  const toolbarCtx = useMemo<TrialToolbarContext>(() => {
    const setZoom = (z: number): void => {
      updateTrialView(trialId, { ...record.view, zoom: z });
    };
    return {
      trialId,
      instrumentName: record.instrumentName,
      hasUndo: instrument.undo != null,
      canUndo: undoBindings?.canUndo ?? false,
      canRedo: undoBindings?.canRedo ?? false,
      undo: undoBindings?.undo ?? (() => {}),
      redo: undoBindings?.redo ?? (() => {}),
      zoom: record.view.zoom,
      setZoom,
      zoomIn: () => setZoom(record.view.zoom * 1.25),
      zoomOut: () => setZoom(record.view.zoom * 0.8),
      resetZoom: () => setZoom(1),
      hasCanvas: instrument.canvas != null,
      savedSnapshots: lab.savedSnapshots.filter((s) => s.trialId === trialId),
      saveSnapshot: (name) => lab.saveSnapshot(trialId, name),
      loadSnapshot: (snapshotId) => lab.loadSnapshot(trialId, snapshotId),
      clone: () => lab.cloneTrial(trialId),
      reset: () => lab.resetTrial(trialId),
      close: () => lab.closeTrial(trialId),
      isLastTrial,
    };
  }, [trialId, record, instrument, lab, isLastTrial, updateTrialView, undoBindings]);

  const sidebarCtx = useMemo<TrialSidebarContext>(
    () => ({
      trialId,
      instrumentName: record.instrumentName,
      configFields: instrument.configSchema?.() ?? [],
      config: record.config,
      setConfig: (key, value) => {
        const prevConfig = record.config as Record<string, unknown>;
        if (process.env.NODE_ENV !== 'production' && !(key in prevConfig)) {
          console.warn(
            `[labkit] setConfig: unknown key "${key}" for instrument "${record.instrumentName}"`,
          );
        }
        updateTrialConfig(trialId, key as never, value as never);
        if (instrument.onConfigChange) {
          const nextConfig = { ...prevConfig, [key]: value };
          const nextState = instrument.onConfigChange(nextConfig, prevConfig, record.state);
          updateTrialState(trialId, nextState as never);
        }
      },
    }),
    [trialId, record, instrument, updateTrialConfig, updateTrialState],
  );

  const statusCtx: TrialStatusBarContext = {
    trialId,
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
      className="lk-trial"
      aria-label={`Trial ${record.instrumentName}`}
      onKeyDown={handleKeyDown}
    >
      <div className="lk-trial__toolbar">
        {toolbar ? toolbar(toolbarCtx) : <DefaultToolbar ctx={toolbarCtx} />}
      </div>
      <div className="lk-trial__body">
        <div className="lk-trial__sidebar">
          {sidebar ? sidebar(sidebarCtx) : <DefaultSidebar ctx={sidebarCtx} />}
          {sidebarExtras}
        </div>
        <div className="lk-trial__content">{children}</div>
      </div>
      <div className="lk-trial__status">
        {statusBar ? statusBar(statusCtx) : <DefaultStatusBar ctx={statusCtx} />}
      </div>
    </section>
  );
}
