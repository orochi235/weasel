import { DevtoolsLabel, matchesKeyBinding, undoKeyStep } from '@weasel-js/core';
import { type ReactNode, useContext, useMemo, useSyncExternalStore } from 'react';
import { useStore } from 'zustand/react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { CameraRegistryContext } from '../canvas/cameraRegistry';
import { zoomCameraTo } from '../canvas/cameraZoom';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import { SidebarRegion } from '../chrome/regions/SidebarRegion';
import { StatusRegion } from '../chrome/regions/StatusRegion';
import { TitleBarRegion } from '../chrome/regions/TitleBarRegion';
import { ToolbarRegion } from '../chrome/regions/ToolbarRegion';
import { ViewportRegion } from '../chrome/regions/ViewportRegion';
import type {
  TrialChromeContext,
  TrialContribution,
  TrialRegion,
  TrialSidebar,
} from '../chrome/types';
import type { AutoReports } from '../config/autoReports';
import { useLabOverValues } from '../config/over';
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
import { FloatSidebarContext } from './FloatSidebar';
import { TrialBody } from './TrialBody';
import { TrialTitleBar } from './TrialTitleBar';
import { TrialTitleContext } from './trialTitle';
import { UndockedSections } from './UndockedSections';
import { useTrialContributions } from './useTrialContributions';
import { useTrialKeys } from './useTrialKeys';
import { useTrialPanels } from './useTrialPanels';
import { type TrialWritesOptions, useTrialWrites } from './useTrialWrites';

/** The trial's loupe as its chrome sees it: its switch, the eyedropper's, and
 *  the color last picked through either. */
export interface LoupeBindings {
  on: boolean;
  toggle: () => void;
  dropper: boolean;
  toggleDropper: () => void;
  picked: string | null;
}

/** The chrome context's loupe fields, from the trial's bindings: all off while no lens is mounted. */
function loupeChrome(loupe: LoupeBindings | undefined) {
  return {
    hasLoupe: loupe != null,
    loupeOn: loupe?.on ?? false,
    toggleLoupe: loupe?.toggle ?? NO_OP,
    dropperOn: loupe?.dropper ?? false,
    toggleDropper: loupe?.toggleDropper ?? NO_OP,
    pickedColor: loupe?.picked ?? null,
  };
}

/** The trial's undo history as its chrome sees it. */
export interface UndoBindings {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** How the lab dresses a trial's chrome, beyond what its instrument declares. */
export interface TrialChromeOptions {
  /** Contributions from the lab, merged last. */
  chrome?: readonly TrialContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
  /** Contribution ids whose buttons to hide, keeping their keys. Throws on an id that is not there. */
  hide?: readonly string[];
  /** Where the sidebar sections go. Default `'dock'`. */
  sidebar?: TrialSidebar;
}

/** Props for `<TrialChrome>`. */
export interface TrialChromeProps extends TrialChromeOptions {
  trialId: string;
  record: TrialRecord;
  instrument: Instrument;
  isLastTrial: boolean;
  undoBindings?: UndoBindings;
  /** The trial's one config write, which `Trial` hands its instrument too.
   *  Omitted, a chrome mounted without a trial makes its own. */
  setConfig?: (path: string, value: unknown) => void;
  /** What the instrument reported for its auto paths, which the settings panel quotes. */
  reported?: AutoReports;
  /** Supplied when the instrument declares a `job`. */
  job?: JobHandle;
  /** Supplied while a lens is mounted in the trial. The lens itself is the
   *  instrument's to mount; the chrome only offers the switch. */
  loupe?: LoupeBindings;
  /** Contributions the trial runtime itself adds — the drag palette and the
   *  layer list, which depend on runtime state the instrument cannot reach. */
  trialChrome?: readonly TrialContribution[];
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

/** The trial's writes, for chrome mounted without a `setConfig`: its marks end a gesture, as in the trial. */
function useChromeWrites(opts: Omit<TrialWritesOptions, 'marks' | 'mounted'>) {
  return useTrialWrites({ ...opts, marks: useContext(AnnotationsContext) });
}

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
  reported,
  job,
  loupe,
  trialChrome,
  chrome,
  suppress,
  hide,
  sidebar = 'dock',
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
  const panels = useTrialPanels(storeCtx.store, trialId);

  const view2d = chromeView(record.view);

  const configSchema = useConfigSchema(instrument);
  const { config: settled, auto } = useResolvedConfig(configSchema, record.config, record.auto);
  const ownWrites = useChromeWrites({
    store: storeCtx.store,
    trialId,
    instrument,
    schema: configSchema,
  });
  const setConfig = setConfigProp ?? ownWrites.setConfig;
  const overValues = useLabOverValues();

  const title = record.title ?? instrument.title ?? instrument.name;

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
      ...loupeChrome(loupe),
      canExpand: lightbox != null,
      expanded: lightbox?.expanded ?? false,
      toggleExpanded: lightbox?.toggle ?? NO_OP,
      configSchema,
      configFields: instrument.config ? [] : (instrument.configSchema?.() ?? []),
      config: record.config,
      auto,
      reported,
      setConfig,
      overValues,
      collapsedSections: record.collapsedSections ?? NO_SECTIONS,
      setSectionCollapsed: (key, collapsed) => setTrialSectionCollapsed(trialId, key, collapsed),
      undockedPanels: panels.undocked,
      undockPanel: panels.undockPanel,
      dockPanel: panels.dockPanel,
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
    reported,
    overValues,
    panels,
    setTrialTitle,
    setTrialSectionCollapsed,
    camera,
  ]);

  const floating = sidebar === 'float';
  const { offered, shown } = useTrialContributions({
    instrument,
    ctx,
    marks: lab.marks,
    controls: lab.controls,
    trialChrome,
    chrome,
    suppress,
    hide,
    sidebar,
  });

  const inRegion = (region: TrialRegion): TrialContribution[] =>
    shown.filter((c) => c.region === region);
  const sections = inRegion('sidebar');
  const docked = <SidebarRegion key="docked" contributions={sections} ctx={ctx} />;
  const undocked = <Undocked key="undocked" sections={sections} ctx={ctx} />;

  const handleKeyDown = (e: KeyboardEvent): void => {
    // A presented trial has no chrome, so nothing the chrome's keys act on.
    if (presented || e.defaultPrevented) return;
    // A chord is its button's: suppress the button and the chord goes with it; hide it and the chord stays.
    const offers = (id: string) => offered.some((c) => c.id === id);
    const step = undoKeyStep(e);
    if (step) {
      if (!offers(step) || !(step === 'undo' ? ctx.canUndo : ctx.canRedo)) return;
      e.preventDefault();
      if (step === 'redo') ctx.redo();
      else ctx.undo();
    } else if (matchesKeyBinding(e, { key: 's', mod: true }) && offers('snapshot')) {
      e.preventDefault();
      if (!e.repeat) ctx.saveSnapshot();
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
      <FloatSidebarContext.Provider value={floating ? { title, sections: docked } : null}>
        <TrialTitleBar
          title={title}
          titleContent={instrument.renderTitle?.(title, { config: settled })}
          lead={<TitleBarRegion placement="lead" contributions={inRegion('titlebar')} ctx={ctx} />}
        >
          <TitleBarRegion contributions={inRegion('titlebar')} ctx={ctx} />
        </TrialTitleBar>
      </FloatSidebarContext.Provider>
      <div className="lk-trial__toolbar">
        <ToolbarRegion contributions={inRegion('toolbar')} ctx={ctx} />
      </div>
      <div className="lk-trial__body">
        <PaletteRegion contributions={inRegion('palette')} ctx={ctx} />
        <TrialBody
          width={record.sidebarWidth}
          onWidthChange={(w) => updateTrialSidebarWidth(trialId, w)}
          contentClassName={contentClassOf(instrument, presented)}
          sidebar={floating || sections.length === 0 ? null : [docked, undocked]}
        >
          <Titled title={title}>{children}</Titled>
          <ViewportRegion contributions={inRegion('viewport')} ctx={ctx} />
          {floating ? undocked : null}
        </TrialBody>
      </div>
      <div className="lk-trial__status">
        {job ? <JobProgress job={job} /> : null}
        <StatusRegion className="lk-trial__readouts" contributions={inRegion('status')} ctx={ctx} />
      </div>
    </section>
  );
}

/** The sidebar sections torn out into the workspace, which the trial goes on rendering wherever the rest are. */
function Undocked({ sections, ctx }: { sections: TrialContribution[]; ctx: TrialChromeContext }) {
  return (
    <UndockedSections
      trialId={ctx.trialId}
      sections={sections.filter((c) => ctx.undockedPanels.includes(c.id))}
      onDock={ctx.dockPanel}
    />
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
