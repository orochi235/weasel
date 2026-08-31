import { type KeyboardEvent, type ReactNode, useContext, useMemo } from 'react';
import { useStore } from 'zustand/react';
import { builtinContributions } from '../chrome/builtins';
import { mergeContributions, suppressContributions } from '../chrome/merge';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import { SidebarRegion } from '../chrome/regions/SidebarRegion';
import { StatusRegion } from '../chrome/regions/StatusRegion';
import { TitleBarRegion } from '../chrome/regions/TitleBarRegion';
import { ToolbarRegion } from '../chrome/regions/ToolbarRegion';
import { ViewportRegion } from '../chrome/regions/ViewportRegion';
import type { TrialChromeContext, TrialContribution, TrialRegion } from '../chrome/types';
import { useConfigSchema } from '../config/useConfigSchema';
import type { Instrument } from '../instrument/types';
import type { JobHandle } from '../job/types';
import { useLabContext } from '../lab/LabContext';
import { JobProgress } from '../primitives/JobProgress';
import { LabStoreContext } from '../state/context';
import type { TrialRecord } from '../state/types';
import { as2DView } from '../state/view';
import { TrialTitleBar } from './TrialTitleBar';
import { UndockedSections } from './UndockedSections';

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
  undoBindings?: UndoBindings;
  /** Supplied when the instrument declares a `job`. */
  job?: JobHandle;
  /** Contributions the trial runtime itself adds — the drag palette and the
   *  layer list, which depend on runtime state the instrument cannot reach. */
  trialChrome?: readonly TrialContribution[];
  /** Contributions from the lab, merged last. */
  chrome?: readonly TrialContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
  /** The trial's resolved tool slot, and the setter that writes whichever
   *  slot it resolved to. `Trial` owns the resolution. */
  activeToolId?: string | null;
  setActiveTool?: (id: string) => void;
  children: ReactNode;
}

const NO_OP = (): void => {};

/** The frame around a running instrument. Builds one chrome context, assembles
 *  the contributions the instrument, the runtime and the lab declare, and hands
 *  each region its slice. */
export function TrialChrome({
  trialId,
  record,
  instrument,
  isLastTrial,
  undoBindings,
  job,
  trialChrome,
  chrome,
  suppress,
  activeToolId = null,
  setActiveTool = NO_OP,
  children,
}: TrialChromeProps) {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] TrialChrome requires <LabStoreProvider>');
  const updateTrialView = useStore(storeCtx.store, (s) => s.updateTrialView);
  const updateTrialConfig = useStore(storeCtx.store, (s) => s.updateTrialConfig);
  const updateTrialState = useStore(storeCtx.store, (s) => s.updateTrialState);
  const undockPanelAction = useStore(storeCtx.store, (s) => s.undockPanel);
  const dockPanelAction = useStore(storeCtx.store, (s) => s.dockPanel);
  const undockedPanels = useStore(storeCtx.store, (s) => s.undockedPanels);
  const undockedIds = useMemo(
    () =>
      Object.values(undockedPanels)
        .filter((p) => p.trialId === trialId)
        .map((p) => p.sectionId),
    [undockedPanels, trialId],
  );

  // The trial view is opaque to labkit, so the zoom chrome asks for the 2D shape
  // and goes inert when the trial holds something else — an orbit, say.
  const view2d = as2DView(record.view);

  const configSchema = useConfigSchema(instrument);

  const ctx = useMemo<TrialChromeContext>(() => {
    const setZoom = (z: number): void => {
      if (!view2d) return;
      updateTrialView(trialId, { ...view2d, zoom: z });
    };
    return {
      trialId,
      instrumentName: record.instrumentName,
      isLastTrial,
      zoom: view2d ? view2d.zoom : null,
      setZoom,
      canUndo: undoBindings?.canUndo ?? false,
      canRedo: undoBindings?.canRedo ?? false,
      undo: undoBindings?.undo ?? NO_OP,
      redo: undoBindings?.redo ?? NO_OP,
      configSchema,
      configFields: instrument.config ? [] : (instrument.configSchema?.() ?? []),
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
      undockedPanels: undockedIds,
      undockPanel: (sectionId, as) => undockPanelAction(trialId, sectionId, as),
      dockPanel: (sectionId) => dockPanelAction(trialId, sectionId),
      savedSnapshots: lab.savedSnapshots.filter((s) => s.trialId === trialId),
      saveSnapshot: (name) => lab.saveSnapshot(trialId, name),
      loadSnapshot: (snapshotId) => lab.loadSnapshot(trialId, snapshotId),
      clone: () => lab.cloneTrial(trialId),
      reset: () => lab.resetTrial(trialId),
      close: () => lab.closeTrial(trialId),
      activeToolId,
      setActiveTool,
    };
  }, [
    trialId,
    record,
    instrument,
    lab,
    isLastTrial,
    updateTrialView,
    updateTrialConfig,
    updateTrialState,
    undoBindings,
    view2d,
    activeToolId,
    setActiveTool,
    configSchema,
    undockedIds,
    undockPanelAction,
    dockPanelAction,
  ]);

  const contributions = useMemo(
    () =>
      suppressContributions(
        mergeContributions(
          builtinContributions(instrument, ctx, lab.controls),
          [...(instrument.chrome ?? [])],
          [...(trialChrome ?? [])],
          [...(chrome ?? [])],
        ),
        suppress ?? [],
      ),
    [instrument, ctx, trialChrome, chrome, suppress, lab.controls],
  );

  const inRegion = (region: TrialRegion): TrialContribution[] =>
    contributions.filter((c) => c.region === region);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) ctx.redo();
      else ctx.undo();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      ctx.saveSnapshot();
    }
  };

  return (
    <section
      className="lk-trial"
      aria-label={`Trial ${record.instrumentName}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <TrialTitleBar title={record.instrumentName}>
        <TitleBarRegion contributions={inRegion('titlebar')} ctx={ctx} />
      </TrialTitleBar>
      <div className="lk-trial__toolbar">
        <ToolbarRegion contributions={inRegion('toolbar')} ctx={ctx} />
      </div>
      <div className="lk-trial__body">
        <PaletteRegion contributions={inRegion('palette')} ctx={ctx} />
        <div className="lk-trial__sidebar">
          <SidebarRegion contributions={inRegion('sidebar')} ctx={ctx} />
          <UndockedSections
            trialId={trialId}
            sections={inRegion('sidebar').filter((c) => undockedIds.includes(c.id))}
            onDock={ctx.dockPanel}
          />
        </div>
        <div className={`lk-trial__content${instrument.canvas ? ' lk-trial__content--flush' : ''}`}>
          {children}
          <ViewportRegion contributions={inRegion('viewport')} ctx={ctx} />
        </div>
      </div>
      <div className="lk-trial__status">
        {job ? <JobProgress job={job} /> : null}
        <StatusRegion contributions={inRegion('status')} ctx={ctx} />
      </div>
    </section>
  );
}
