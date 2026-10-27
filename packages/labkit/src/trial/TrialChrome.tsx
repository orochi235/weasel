import { DevtoolsLabel } from '@weasel-js/core';
import { type ReactNode, useContext, useMemo, useSyncExternalStore } from 'react';
import { useStore } from 'zustand/react';
import { withMarks } from '../annotations/labMarks';
import { CameraRegistryContext } from '../canvas/cameraRegistry';
import { zoomCameraTo } from '../canvas/cameraZoom';
import { builtinContributions, TRANSIENT_BUILTINS } from '../chrome/builtins';
import { mergeContributions, suppressContributions } from '../chrome/merge';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import { SidebarRegion } from '../chrome/regions/SidebarRegion';
import { StatusRegion } from '../chrome/regions/StatusRegion';
import { TitleBarRegion } from '../chrome/regions/TitleBarRegion';
import { ToolbarRegion } from '../chrome/regions/ToolbarRegion';
import { ViewportRegion } from '../chrome/regions/ViewportRegion';
import type { TrialChromeContext, TrialContribution, TrialRegion } from '../chrome/types';
import { useConfigSchema } from '../config/useConfigSchema';
import { useResolvedConfig } from '../config/useResolvedConfig';
import type { Instrument } from '../instrument/types';
import type { JobHandle } from '../job/types';
import { useLabCommands } from '../lab/LabContext';
import { usePresentedTrial } from '../lab/presentation';
import { useLightboxControl } from '../lightbox/LightboxContext';
import { JobProgress } from '../primitives/JobProgress';
import { LabStoreContext } from '../state/context';
import type { TrialRecord } from '../state/types';
import { as2DView, DEFAULT_VIEW, withZoom } from '../state/view';
import { undoKeyStep } from '../undo/useUndoKeys';
import { TrialBody } from './TrialBody';
import { TrialTitleBar } from './TrialTitleBar';
import { TrialTitleContext } from './trialTitle';
import { UndockedSections } from './UndockedSections';
import { useTrialKeys } from './useTrialKeys';
import { useTrialWrites } from './useTrialWrites';

/** The trial's loupe as its chrome sees it: a switch and its position. */
export interface LoupeBindings {
  on: boolean;
  toggle: () => void;
}

/** The trial's undo history as its chrome sees it. */
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
  /** The trial's one config write, which `Trial` hands its instrument too.
   *  Omitted, a chrome mounted without a trial makes its own. */
  setConfig?: (path: string, value: unknown) => void;
  /** Supplied when the instrument declares a `job`. */
  job?: JobHandle;
  /** Supplied while a lens is mounted in the trial. The lens itself is the
   *  instrument's to mount; the chrome only offers the switch. */
  loupe?: LoupeBindings;
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

/** One frozen empty map, so a trial that has folded nothing keeps a stable
 *  context identity across renders. */
const NO_SECTIONS: Readonly<Record<string, boolean>> = Object.freeze({});
const noSubscribe = (): (() => void) => NO_OP;

/** The trial view is opaque to labkit, so the zoom chrome asks for the 2D shape and goes inert
 *  when the trial holds something else — an orbit, say. An unplaced view reads as the default
 *  its canvas paints, so the status strip is in before the first fit. */
const chromeView = (view: unknown) => as2DView(view) ?? (view === null ? DEFAULT_VIEW : null);

/** The trial body's content class: flush for an instrument that draws its own canvas or stage. */
const contentClassOf = (instrument: Instrument, presented: boolean): string | undefined =>
  [
    instrument.canvas || instrument.stage ? 'lk-trial__content--flush' : '',
    presented ? 'lk-trial__stage' : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

/** The frame around a running instrument. Builds one chrome context, assembles
 *  the contributions the instrument, the runtime and the lab declare, and hands
 *  each region its slice. */
export function TrialChrome({
  trialId,
  record,
  instrument,
  isLastTrial,
  undoBindings,
  setConfig: setConfigProp,
  job,
  loupe,
  trialChrome,
  chrome,
  suppress,
  activeToolId = null,
  setActiveTool = NO_OP,
  children,
}: TrialChromeProps) {
  const lab = useLabCommands();
  const { presented, ref: presentedRef } = usePresentedTrial(trialId);
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] TrialChrome requires <LabStoreProvider>');
  const updateTrialView = useStore(storeCtx.store, (s) => s.updateTrialView);
  const updateTrialSidebarWidth = useStore(storeCtx.store, (s) => s.updateTrialSidebarWidth);
  const setTrialTitle = useStore(storeCtx.store, (s) => s.setTrialTitle);
  const setTrialSectionCollapsed = useStore(storeCtx.store, (s) => s.setTrialSectionCollapsed);
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

  // The view is opaque to labkit: a trial's camera reads its zoom; without one, a 2D view has it.
  const view2d = chromeView(record.view);

  const configSchema = useConfigSchema(instrument);
  const { auto } = useResolvedConfig(configSchema, record.config, record.auto);
  const ownWrites = useTrialWrites({
    store: storeCtx.store,
    trialId,
    instrument,
    schema: configSchema,
  });
  const setConfig = setConfigProp ?? ownWrites.setConfig;

  const title = record.title ?? instrument.title ?? instrument.name;
  const collapsedSections = record.collapsedSections ?? NO_SECTIONS;

  // A trial's own camera zooms about the view's middle, in the instrument's range, as the lab's does.
  const cameras = useContext(CameraRegistryContext);
  const camera = useSyncExternalStore(
    cameras?.subscribe ?? noSubscribe,
    () => cameras?.get(trialId) ?? null,
  );

  // The title bar carries the expand toggle, so the lightbox drops its own.
  const lightbox = useLightboxControl();

  const ctx = useMemo<TrialChromeContext>(() => {
    const setZoom = (z: number): void => {
      if (camera) zoomCameraTo(camera, z);
      else if (view2d) updateTrialView(trialId, withZoom(view2d, z));
    };
    return {
      trialId,
      instrumentName: record.instrumentName,
      title,
      setTitle: (next) => setTrialTitle(trialId, next),
      isLastTrial,
      zoom: camera ? camera.zoomOf(record.view) : (view2d?.zoom ?? null),
      setZoom,
      canUndo: undoBindings?.canUndo ?? false,
      canRedo: undoBindings?.canRedo ?? false,
      undo: undoBindings?.undo ?? NO_OP,
      redo: undoBindings?.redo ?? NO_OP,
      hasLoupe: loupe != null,
      loupeOn: loupe?.on ?? false,
      toggleLoupe: loupe?.toggle ?? NO_OP,
      canExpand: lightbox != null,
      expanded: lightbox?.expanded ?? false,
      toggleExpanded: lightbox?.toggle ?? NO_OP,
      configSchema,
      configFields: instrument.config ? [] : (instrument.configSchema?.() ?? []),
      config: record.config,
      auto,
      setConfig,
      collapsedSections,
      setSectionCollapsed: (key, collapsed) => setTrialSectionCollapsed(trialId, key, collapsed),
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
    title,
    isLastTrial,
    updateTrialView,
    setConfig,
    undoBindings,
    loupe,
    lightbox,
    view2d,
    activeToolId,
    setActiveTool,
    configSchema,
    auto,
    undockedIds,
    undockPanelAction,
    dockPanelAction,
    setTrialTitle,
    setTrialSectionCollapsed,
    collapsedSections,
    camera,
  ]);

  const contributions = useMemo(
    () =>
      suppressContributions(
        mergeContributions(
          builtinContributions(withMarks(instrument, lab.marks), ctx, lab.controls),
          [...(instrument.chrome ?? [])],
          [...(trialChrome ?? [])],
          [...(chrome ?? [])],
        ),
        suppress ?? [],
        TRANSIENT_BUILTINS,
      ),
    [instrument, ctx, trialChrome, chrome, suppress, lab.controls, lab.marks],
  );

  const inRegion = (region: TrialRegion): TrialContribution[] =>
    contributions.filter((c) => c.region === region);

  const handleKeyDown = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey;
    // A presented trial has no chrome, so nothing the chrome's keys act on.
    if (!mod || presented || e.defaultPrevented) return;
    // A chord is its button's: suppress the button and the chord goes with it.
    const offered = (id: string) => contributions.some((c) => c.id === id);
    const step = undoKeyStep(e);
    if (step) {
      if (!offered(step)) return;
      e.preventDefault();
      if (step === 'redo') ctx.redo();
      else ctx.undo();
    } else if ((e.key === 's' || e.key === 'S') && offered('snapshot')) {
      e.preventDefault();
      ctx.saveSnapshot();
    }
  };
  // With focus on the page body the chords go to the lab's focused trial, the first where none was picked.
  useTrialKeys(trialId, lab.focusedTrialId === trialId, handleKeyDown);

  return (
    <section
      ref={presentedRef}
      className="lk-trial"
      data-trial-id={trialId}
      data-focused={!isLastTrial && lab.focusedTrialId === trialId ? 'true' : undefined}
      data-lk-presented={presented ? '' : undefined}
      aria-label={`Trial ${title}`}
      tabIndex={-1}
    >
      <TrialTitleBar
        title={title}
        titleContent={instrument.renderTitle?.(title)}
        lead={<TitleBarRegion placement="lead" contributions={inRegion('titlebar')} ctx={ctx} />}
      >
        <TitleBarRegion contributions={inRegion('titlebar')} ctx={ctx} />
      </TrialTitleBar>
      <div className="lk-trial__toolbar">
        <ToolbarRegion contributions={inRegion('toolbar')} ctx={ctx} />
      </div>
      <div className="lk-trial__body">
        <PaletteRegion contributions={inRegion('palette')} ctx={ctx} />
        <TrialBody
          width={record.sidebarWidth}
          onWidthChange={(w) => updateTrialSidebarWidth(trialId, w)}
          contentClassName={contentClassOf(instrument, presented)}
          sidebar={
            inRegion('sidebar').length === 0 ? null : (
              <>
                <SidebarRegion contributions={inRegion('sidebar')} ctx={ctx} />
                <UndockedSections
                  trialId={trialId}
                  sections={inRegion('sidebar').filter((c) => undockedIds.includes(c.id))}
                  onDock={ctx.dockPanel}
                />
              </>
            )
          }
        >
          <Titled title={title}>{children}</Titled>
          <ViewportRegion contributions={inRegion('viewport')} ctx={ctx} />
        </TrialBody>
      </div>
      <div className="lk-trial__status">
        {job ? <JobProgress job={job} /> : null}
        <StatusRegion contributions={inRegion('status')} ctx={ctx} />
      </div>
    </section>
  );
}

/** The trial's title, to what it renders and to a devtools panel listing its canvases. */
function Titled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <TrialTitleContext.Provider value={title}>
      <DevtoolsLabel value={title}>{children}</DevtoolsLabel>
    </TrialTitleContext.Provider>
  );
}
