import { type ColorList, colorCount, type Theme } from '@weasel-js/theme';
import { ThemeProvider, useResolvedColorMode } from '@weasel-js/theme/react';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStore } from 'zustand/react';
import { AnnotationPreloadContext } from '../annotations/preload';
import { labAnnotationTools } from '../annotations/toolMap';
import { type CameraGestures, CameraGesturesContext } from '../canvas/cameraGestures';
import { CameraRegistryContext, createCameraRegistry } from '../canvas/cameraRegistry';
import {
  LabAsideRegion,
  LabFooterRegion,
  LabHeaderRegion,
  LabSidebarRegion,
  labContributions,
} from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import type { TrialContribution } from '../chrome/types';
import { ClockRegistryContext, createClockRegistry } from '../clock/clockRegistry';
import { useClockLoop } from '../clock/useClockLoop';
import type { ConfigRule, ControlRenderer } from '../config/types';
import type { InstrumentList } from '../instrument/types';
import { Split } from '../primitives/Split';
import { LabStoreContext } from '../state/context';
import { PersistenceContext } from '../state/Persistence';
import type { LabDensity, LabMode, StorageAdapter, TrialRecord } from '../state/types';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
import { usePersistedState } from '../state/usePersistedState';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { interstellarTheme } from '../theme/interstellar';
import type { TrialTool } from '../tools/types';
import { Trial } from '../trial/Trial';
import {
  addTrial as addTrialOp,
  cloneTrial as cloneTrialOp,
  closeTrial as closeTrialOp,
  reorderTrials as reorderTrialsOp,
  resetTrial as resetTrialOp,
  swapTrial as swapTrialOp,
} from '../trial/trialOps';
import { useLabFitWarning } from './fitCheck';
import { LabContext, type LabContextValue } from './LabContext';
import { LabHeader, LabThemeSwitcher } from './LabHeader';
import { LabPalette } from './LabPalette';
import { LabShell } from './LabShell';
import { LabSurface } from './LabSurface';
import type { LabPage } from './LabSwitcher';
import { LabZoom } from './LabZoom';
import { buildNebula } from './nebula';
import {
  type OpenedLab,
  openStoredLab,
  openUnstoredLab,
  type PresentationSeed,
  presentStorageKey,
} from './openLab';
import { createPanelHostRegistry, PanelHostContext } from './panelHost';
import { hasPresentParam, PresentationContext, useLabPresentation } from './presentation';
import { useFocusPick } from './useFocusPick';
import { type PanelDescriptor, type TrialLayout, Workspace } from './Workspace';

interface LabBaseProps {
  /** May change while mounted. An instrument that is a different object from
   *  the last render counts as replaced and its open trials' configs are
   *  refilled, so hoist or memoize the list. */
  instruments: InstrumentList;
  defaultInstrument: string;
  mode?: LabMode;
  /** How much room the lab's chrome takes. Default `'comfortable'`; a lab whose
   *  window is the whole app, rather than a panel beside one, reads better at
   *  `'roomy'`. The trials' own contents are unaffected. */
  density?: LabDensity;
  /** The theme the lab's chrome resolves against, applied at `mode` and
   *  `density`. Default `interstellarTheme`; extend it rather than replace it to
   *  keep the lab's look while changing a few tokens. */
  theme?: Theme;
  /** Rendered while a stored lab loads. Default: the lab's empty shell. */
  fallback?: ReactNode;
  /**
   * Colors composing the interstellar theme's cosmic backdrop. Each becomes
   * one radial-gradient blob on the dark void base, in a fixed spread of
   * positions; extras wrap around. A theme ramp resolves against the lab's
   * theme; a function list gives as many blobs as there are positions.
   * Ignored unless the resolved mode is dark.
   */
  nebula?: ColorList;
  title?: string;
  /** The project's other labs. Given two or more, the title becomes the way to
   *  reach them — the same switcher `<LabShell>` renders, so a lab reached from
   *  one is not a dead end. */
  pages?: readonly LabPage[];
  /** The path the switcher marks as open. Defaults to the current location. */
  path?: string;
  /** Rendered in the shell's footer, below the workspace. */
  footer?: ReactNode;
  /** Contributions added to every trial's chrome, after the instrument's own. */
  chrome?: readonly TrialContribution[];
  /** Contributions to the lab's own chrome — its header bar, its sidebar, its
   *  tool rail and its footer — rather than to every trial's. Rendered after
   *  `children` and `footer`, which stay the way a lab drops arbitrary content
   *  into those same two boxes. Going from no sidebar contributions to some
   *  remounts the workspace and every trial, dropping unpersisted trial state. */
  labChrome?: readonly LabContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
  /** Whether a double-click on a trial also opens it in its lightbox, beside
   *  the title bar's expand toggle every trial has. Off by default; a
   *  function decides per trial, by its record. */
  expandOnDoubleClick?: boolean | ((trial: TrialRecord) => boolean);
  /** Offer the header's add-trial control. Default `true`; a lab that opens
   *  trials some other way passes `false`. */
  addTrial?: boolean;
  /** Offer the header's zoom controls, which act on the focused trial's camera
   *  and answer Mod+=, Mod+- and Mod+0. Default `true`. */
  zoom?: boolean;
  /** Tools offered lab-wide. A trial whose instrument declares none of its own
   *  reflects and writes this slot. */
  tools?: readonly TrialTool[];
  /** Rules run over every instrument's config leaves, before labkit's own
   *  inference — where a lab states a convention once instead of annotating
   *  each field. Memoize or hoist. */
  configRules?: readonly ConfigRule[];
  /** Control overrides and app-defined kinds for every trial's settings panel.
   *  Keys are config paths (checked first) or leaf kinds. Memoize or hoist. */
  controls?: Record<string, ControlRenderer>;
  children?: ReactNode;
  /** Start presenting: one trial, opened on `seed`, without the lab's chrome or
   *  its own. `?present` in the page's URL does the same. Read once, at mount.
   *  A stored lab presents from its own records, under `storageKey` +
   *  `':present'`, so an embed never shows or changes the full lab's trials. */
  present?: boolean;
  /** The trial a lab that starts presenting opens on. A store that already
   *  holds a trial opened on this same seed keeps it; a changed seed replaces
   *  it. Ignored unless the lab starts presenting. */
  seed?: PresentationSeed;
  /** Gestures every trial's camera takes, over its instrument's own one by
   *  one — `{ wheel: false, pan: false }` lets the page scroll past an embed. */
  gestures?: CameraGestures;
}

/** Props for `<Lab>`. With a `storageKey` the lab persists — to IndexedDB
 *  unless `storage` names another substrate — and both are read once, at
 *  mount. Without one, nothing persists. */
export type LabProps = LabBaseProps &
  (
    | { storageKey?: undefined; storage?: undefined }
    | { storageKey: string; storage?: StorageAdapter }
  );

function LabFallback({
  title,
  mode,
  density,
  theme = interstellarTheme,
  pages,
  path,
}: Pick<LabBaseProps, 'title' | 'mode' | 'density' | 'theme' | 'pages' | 'path'>) {
  const resolvedMode = useResolvedColorMode(mode ?? 'auto');
  return (
    <ThemeProvider
      theme={theme}
      selection={{ mode: resolvedMode, density: density ?? 'comfortable' }}
      className="lk-lab"
    >
      <LabShell
        title={title ?? 'Labkit'}
        mode={mode}
        {...(pages ? { pages } : {})}
        {...(path !== undefined ? { path } : {})}
      >
        {null}
      </LabShell>
    </ThemeProvider>
  );
}

/** The strip holding the sidebar beside the tool rail and workspace. Its own component
 *  because the width is a persisted value, and `LabRuntime` renders the
 *  persistence provider it reads from. */
function LabPanes({
  contributions,
  children,
}: {
  contributions: readonly LabContribution[];
  children: ReactNode;
}) {
  const surface = useSurfaceOptional();
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number | undefined>(
    'lk-lab-sidebar-width',
    undefined,
    { scope: 'lab' },
  );
  const [asideWidth, setAsideWidth] = usePersistedState<number | undefined>(
    'lk-lab-aside-width',
    undefined,
    { scope: 'lab' },
  );
  const main = contributions.some((c) => c.region === 'aside') ? (
    <Split
      className="lk-lab__panes"
      side="end"
      sidebarClassName="lk-lab__aside"
      contentClassName="lk-lab__main"
      label="Lab aside"
      defaultWidth={320}
      width={asideWidth}
      onWidthChange={(w) => {
        setAsideWidth(w);
        surface?.invalidateRects();
      }}
      sidebar={<LabAsideRegion contributions={contributions} />}
    >
      {children}
    </Split>
  ) : (
    children
  );
  if (!contributions.some((c) => c.region === 'sidebar')) return main;
  return (
    <Split
      className="lk-lab__panes"
      sidebarClassName="lk-lab__sidebar"
      contentClassName="lk-lab__main"
      label="Lab sidebar"
      defaultWidth={260}
      width={sidebarWidth}
      onWidthChange={(w) => {
        setSidebarWidth(w);
        surface?.invalidateRects();
      }}
      sidebar={<LabSidebarRegion contributions={contributions} />}
    >
      {main}
    </Split>
  );
}

/** The lab runtime: opens the store, provides it, and renders one trial
 *  per record in a grid. Each trial runs one of `instruments`. */
export function Lab(props: LabProps) {
  if (process.env.NODE_ENV !== 'production' && props.instruments.length === 0) {
    throw new Error('[labkit] <Lab> requires a non-empty `instruments` array');
  }
  const { storageKey, storage, present } = props;
  useWarnIgnoredChange('<Lab>', { storageKey, storage, present });
  const [startsPresenting] = useState(() => present === true || hasPresentParam());
  if (process.env.NODE_ENV !== 'production' && props.seed && !startsPresenting) {
    warnSeedIgnored();
  }
  const opened = useOpenOnce<OpenedLab>(() => {
    const seed = startsPresenting ? (props.seed ?? {}) : undefined;
    if (storageKey === undefined) return openUnstoredLab(props, seed);
    const key = startsPresenting ? presentStorageKey(storageKey) : storageKey;
    return openStoredLab(props, key, storage, seed);
  });
  if (!opened) {
    if (props.fallback !== undefined) return props.fallback;
    // An embed shows nothing until its trial is ready, never the lab's shell.
    if (startsPresenting) return null;
    return (
      <LabFallback
        title={props.title}
        mode={props.mode}
        density={props.density}
        {...(props.theme ? { theme: props.theme } : {})}
        pages={props.pages}
        path={props.path}
      />
    );
  }
  return <LabRuntime {...props} opened={opened} startsPresenting={startsPresenting} />;
}

let seedWarned = false;
function warnSeedIgnored(): void {
  if (seedWarned) return;
  seedWarned = true;
  console.warn('[labkit] <Lab> reads `seed` only when it starts presenting; it is ignored here');
}

function LabRuntime({
  instruments,
  mode,
  density,
  theme = interstellarTheme,
  nebula,
  title,
  pages,
  path,
  footer,
  chrome,
  labChrome,
  suppress,
  expandOnDoubleClick = false,
  addTrial,
  zoom = true,
  tools,
  configRules,
  controls,
  gestures,
  children,
  opened,
  startsPresenting,
}: LabProps & { opened: OpenedLab; startsPresenting: boolean }) {
  const { store } = opened;

  // The store opened against the list <Lab> mounted with; a later list reaches
  // it here, before paint.
  useLayoutEffect(() => {
    store.getState().setInstruments(instruments);
  }, [instruments, store]);

  const trials = useStore(store, (s) => s.trials);
  const [cameras] = useState(createCameraRegistry);
  const [clocks] = useState(createClockRegistry);
  useClockLoop(clocks);
  const [focusPick, setFocusPick] = useState<string | null>(null);
  const focusedTrialId = trials.some((t) => t.id === focusPick)
    ? focusPick
    : (trials[0]?.id ?? null);
  const savedSnapshots = useStore(store, (s) => s.savedSnapshots);
  const modeValue = useStore(store, (s) => s.mode);
  const layout = useStore(store, (s) => s.layout);
  const undockedPanels = useStore(store, (s) => s.undockedPanels);

  // One registry for the lab's lifetime: a panel host is a DOM node the
  // workspace owns and the trial portals into, so it must outlive both ends of
  // a dock/undock without being rebuilt.
  const panelHostsRef = useRef<ReturnType<typeof createPanelHostRegistry> | null>(null);
  if (panelHostsRef.current === null) panelHostsRef.current = createPanelHostRegistry();

  const [labBody, setLabBody] = useState<HTMLDivElement | null>(null);
  useLabFitWarning(labBody);

  useFocusPick(labBody, store, setFocusPick);
  const presentation = useLabPresentation(startsPresenting, focusedTrialId, labBody);
  const presenting = presentation.active;
  const workspacePanels = useMemo<PanelDescriptor[]>(
    () =>
      Object.entries(undockedPanels).map(([key, panel]) => ({
        key,
        title: panel.sectionId,
        as: panel.as,
      })),
    [undockedPanels],
  );
  const resolvedMode = useResolvedColorMode(modeValue);

  // Tools and lab contributions share one id namespace, so they merge once
  // here — before any region renders — and a collision throws rather than one
  // of them silently losing.
  // Declaring `annotations` on any instrument puts the drawing tools here, in
  // the lab's rail: one tool is armed across every trial.
  const annotationTools = useMemo(() => labAnnotationTools(instruments), [instruments]);
  const labChromeAll = useMemo(
    () => labContributions([...annotationTools, ...(tools ?? [])], labChrome),
    [annotationTools, tools, labChrome],
  );
  const hasFooterChrome = labChromeAll.some((c) => c.region === 'footer');
  const hasPaneChrome = labChromeAll.some((c) => c.region === 'sidebar' || c.region === 'aside');

  useEffect(() => {
    if (mode && mode !== store.getState().mode) {
      store.getState().setMode(mode);
    }
  }, [mode, store]);

  const contextValue = useMemo<LabContextValue>(() => {
    const replaceTrials = (next: TrialRecord[]): void => {
      const currentById = new Map(store.getState().trials.map((w) => [w.id, w]));
      const merged = next.map((w) => currentById.get(w.id) ?? w);
      store.setState({ trials: merged });
    };
    const replaceAndFocusAdded = (next: TrialRecord[]): void => {
      const before = new Set(store.getState().trials.map((w) => w.id));
      replaceTrials(next);
      const added = next.find((w) => !before.has(w.id));
      if (added) setFocusPick(added.id);
    };

    return {
      instruments,
      trials,
      addTrial: (instrumentName, options) => {
        replaceAndFocusAdded(
          addTrialOp(store.getState().trials, instruments, instrumentName, options),
        );
      },
      cloneTrial: (id) => {
        replaceAndFocusAdded(cloneTrialOp(store.getState().trials, id));
      },
      closeTrial: (id) => {
        const next = closeTrialOp(store.getState().trials, id);
        replaceTrials(next);
      },
      reorderTrials: (ids) => {
        replaceTrials(reorderTrialsOp(store.getState().trials, ids));
      },
      swapTrial: (id, instrumentName, options) => {
        const current = store.getState();
        const next = swapTrialOp(current.trials, instruments, id, instrumentName, options);
        if (next === current.trials) return;
        const record = next[current.trials.findIndex((w) => w.id === id)] as TrialRecord;
        // Written before the tile registers, which is when the grid reads it.
        const { [id]: extent, ...layoutRest } = current.layout as TrialLayout;
        if (extent) current.setLayout({ ...layoutRest, [record.id]: extent });
        replaceTrials(next);
        if (focusedTrialId === id) setFocusPick(record.id);
      },
      focusedTrialId,
      focusTrial: (id) => setFocusPick(id),
      resetTrial: (id) => {
        const next = resetTrialOp(store.getState().trials, id, instruments);
        const record = next.find((w) => w.id === id);
        if (!record) return;
        store.setState((s) => ({
          trials: s.trials.map((w) =>
            w.id === id
              ? { ...w, config: record.config, state: record.state, view: record.view }
              : w,
          ),
        }));
        clocks.get(id)?.reset();
      },
      savedSnapshots,
      saveSnapshot: (trialId, name) => {
        const taken = store.getState().savedSnapshots.filter((s) => s.trialId === trialId).length;
        store.getState().saveSnapshot(trialId, name ?? `Snapshot ${taken + 1}`);
      },
      loadSnapshot: (trialId, snapshotId) => {
        store.getState().loadSnapshot(snapshotId, trialId);
      },
      deleteSnapshot: (snapshotId) => {
        store.getState().deleteSnapshot(snapshotId);
      },
      mode: modeValue,
      setMode: (m) => {
        store.getState().setMode(m);
      },
      configRules,
      controls,
    };
  }, [
    clocks,
    instruments,
    trials,
    focusedTrialId,
    savedSnapshots,
    modeValue,
    store,
    configRules,
    controls,
  ]);

  // Only override the backdrop in dark, where there is one to override.
  // Setting a CSS custom property is the sanctioned use of inline style.
  const backdropStyle =
    resolvedMode === 'dark' && nebula && colorCount(nebula) !== 0
      ? ({
          ['--wzl-backdrop' as string]: buildNebula(
            nebula,
            theme,
            resolvedMode,
            density ?? 'comfortable',
          ),
        } as CSSProperties)
      : undefined;

  const workspace = (
    <Workspace
      panels={workspacePanels}
      ids={trials.map((w) => w.id)}
      resizable
      reorderable
      onReorder={(ids) => contextValue.reorderTrials(ids)}
      layout={layout as TrialLayout}
      onLayoutChange={(next) => store.getState().setLayout(next)}
      expandOnDoubleClick={
        typeof expandOnDoubleClick === 'function'
          ? (id) => {
              const trial = trials.find((t) => t.id === id);
              return trial ? expandOnDoubleClick(trial) : false;
            }
          : expandOnDoubleClick
      }
    >
      {trials.map((w) => (
        <Trial key={w.id} id={w.id} chrome={chrome} suppress={suppress} />
      ))}
    </Workspace>
  );

  return (
    <LabStoreContext.Provider value={{ store }}>
      <PersistenceContext.Provider value={opened.records}>
        <AnnotationPreloadContext.Provider value={opened.marks}>
          <LabContext.Provider value={contextValue}>
            <PresentationContext.Provider value={presentation}>
              <CameraRegistryContext.Provider value={cameras}>
                <CameraGesturesContext.Provider value={gestures ?? null}>
                  <ClockRegistryContext.Provider value={clocks}>
                    <ThemeProvider
                      theme={theme}
                      selection={{ mode: resolvedMode, density: density ?? 'comfortable' }}
                      className={presenting ? 'lk-lab lk-lab--present' : 'lk-lab'}
                      style={backdropStyle}
                    >
                      <LabShell
                        title={title ?? 'Labkit'}
                        mode={modeValue}
                        {...(pages ? { pages } : {})}
                        {...(path !== undefined ? { path } : {})}
                        footer={
                          hasFooterChrome ? (
                            <>
                              {footer}
                              <LabFooterRegion contributions={labChromeAll} />
                            </>
                          ) : (
                            footer
                          )
                        }
                        header={
                          <>
                            <LabHeader {...(addTrial !== undefined ? { addTrial } : {})} />
                            {zoom && !presenting ? <LabZoom /> : null}
                            {children}
                            <LabHeaderRegion contributions={labChromeAll} />
                            <LabThemeSwitcher />
                          </>
                        }
                      >
                        <PanelHostContext.Provider value={panelHostsRef.current}>
                          <LabSurface bodyRef={setLabBody}>
                            {hasPaneChrome ? (
                              <LabPanes contributions={labChromeAll}>
                                <LabPalette contributions={labChromeAll} />
                                {workspace}
                              </LabPanes>
                            ) : (
                              <>
                                <LabPalette contributions={labChromeAll} />
                                {workspace}
                              </>
                            )}
                          </LabSurface>
                        </PanelHostContext.Provider>
                      </LabShell>
                    </ThemeProvider>
                  </ClockRegistryContext.Provider>
                </CameraGesturesContext.Provider>
              </CameraRegistryContext.Provider>
            </PresentationContext.Provider>
          </LabContext.Provider>
        </AnnotationPreloadContext.Provider>
      </PersistenceContext.Provider>
    </LabStoreContext.Provider>
  );
}
