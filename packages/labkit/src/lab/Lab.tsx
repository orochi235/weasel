import { colorCount } from '@weasel-js/theme';
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
import { CameraGesturesContext } from '../canvas/cameraGestures';
import { CameraRegistryContext, createCameraRegistry } from '../canvas/cameraRegistry';
import {
  LabAsideRegion,
  LabFooterRegion,
  LabHeaderRegion,
  LabSidebarRegion,
  labContributions,
} from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import { ClockRegistryContext } from '../clock/clockRegistry';
import { useLabClocks } from '../clock/useLabClocks';
import { Split } from '../primitives/Split';
import { PersistenceContext } from '../state/Persistence';
import type { TrialRecord } from '../state/types';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
import { usePersistedState } from '../state/usePersistedState';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { interstellarTheme } from '../theme/interstellar';
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
import type { LabCommands } from './LabContext';
import { LabHeader, LabThemeSwitcher } from './LabHeader';
import { LabPalette } from './LabPalette';
import { LabProviders } from './LabProviders';
import { LabShell } from './LabShell';
import { LabSurface } from './LabSurface';
import { LabZoom } from './LabZoom';
import type { LabBaseProps, LabProps } from './labProps';
import { buildNebula } from './nebula';
import { type OpenedLab, openStoredLab, openUnstoredLab, presentStorageKey } from './openLab';
import { createPanelHostRegistry, PanelHostContext } from './panelHost';
import {
  labClassName,
  PresentationContext,
  type PresentationStart,
  presentationStart,
  useLabPresentation,
} from './presentation';
import { useFocusPick } from './useFocusPick';
import { type PanelDescriptor, type TrialLayout, Workspace } from './Workspace';

function LabFallback({
  title,
  mode,
  density,
  theme = interstellarTheme,
  pages,
  path,
  documentTitle,
}: Pick<
  LabBaseProps,
  'title' | 'documentTitle' | 'mode' | 'density' | 'theme' | 'pages' | 'path'
>) {
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
        {...(documentTitle !== undefined ? { documentTitle } : {})}
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
  const { storageKey, storage, present, still, clock } = props;
  useWarnIgnoredChange('<Lab>', { storageKey, storage, present, still, clock });
  const [start] = useState(() => presentationStart(present, still));
  if (process.env.NODE_ENV !== 'production' && props.seed && !start.presenting) {
    warnSeedIgnored();
  }
  const opened = useOpenOnce<OpenedLab>(() => {
    const seed = start.presenting ? (props.seed ?? {}) : undefined;
    // A still is the seed and nothing else, whoever's browser takes it.
    if (storageKey === undefined || start.still) return openUnstoredLab(props, seed);
    const key = start.presenting ? presentStorageKey(storageKey) : storageKey;
    return openStoredLab(props, key, storage, seed);
  });
  if (!opened) {
    if (props.fallback !== undefined) return props.fallback;
    // An embed shows nothing until its trial is ready, never the lab's shell.
    if (start.presenting) return null;
    return (
      <LabFallback
        title={props.title}
        {...(props.documentTitle !== undefined ? { documentTitle: props.documentTitle } : {})}
        mode={props.mode}
        density={props.density}
        {...(props.theme ? { theme: props.theme } : {})}
        pages={props.pages}
        path={props.path}
      />
    );
  }
  return <LabRuntime {...props} opened={opened} start={start} />;
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
  documentTitle,
  clock,
  pages,
  path,
  footer,
  chrome,
  labChrome,
  suppress,
  expandOnDoubleClick = false,
  addTrial,
  zoom = true,
  header = true,
  tools,
  configRules,
  controls,
  gestures,
  transport = true,
  messages = true,
  children,
  opened,
  start,
}: LabProps & { opened: OpenedLab; start: PresentationStart }) {
  const { store } = opened;

  // The store opened against the list <Lab> mounted with; a later list reaches
  // it here, before paint.
  useLayoutEffect(() => {
    store.getState().setInstruments(instruments);
  }, [instruments, store]);

  const trials = useStore(store, (s) => s.trials);
  const [cameras] = useState(createCameraRegistry);
  const clocks = useLabClocks(clock, opened.records);
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
  const options = { transport, messages };
  const presentation = useLabPresentation(start, focusedTrialId, labBody, clocks, options);
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

  const commands = useMemo<LabCommands>(() => {
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
      addTrial: (instrumentName, options) => {
        replaceAndFocusAdded(
          addTrialOp(store.getState().trials, instruments, instrumentName, options),
        );
      },
      cloneTrial: (id) => {
        replaceAndFocusAdded(cloneTrialOp(store.getState().trials, id));
      },
      closeTrial: (id) => {
        const current = store.getState();
        // A lab keeps its last trial; `closeTrialOp` is what says whether this is it.
        if (closeTrialOp(current.trials, id) !== current.trials) current.removeTrial(id);
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
          trials: s.trials.map((w) => {
            if (w.id !== id) return w;
            const { auto: _pinnedNow, ...kept } = w;
            const reset: TrialRecord = {
              ...kept,
              config: record.config,
              state: record.state,
              view: record.view,
            };
            if (record.auto) reset.auto = record.auto;
            return reset;
          }),
        }));
        const handle = clocks.get(id);
        // The lab's clock is every trial's on it, so resetting one leaves it.
        if (handle !== clocks.lab) handle?.reset();
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
      onReorder={(ids) => commands.reorderTrials(ids)}
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
    <LabProviders store={store} commands={commands} trials={trials}>
      <PersistenceContext.Provider value={opened.records}>
        <AnnotationPreloadContext.Provider value={opened.marks}>
          <PresentationContext.Provider value={presentation}>
            <CameraRegistryContext.Provider value={cameras}>
              <CameraGesturesContext.Provider value={gestures ?? null}>
                <ClockRegistryContext.Provider value={clocks}>
                  <ThemeProvider
                    theme={theme}
                    selection={{ mode: resolvedMode, density: density ?? 'comfortable' }}
                    className={labClassName(presentation)}
                    style={backdropStyle}
                  >
                    <LabShell
                      title={title ?? 'Labkit'}
                      bar={header}
                      mode={modeValue}
                      {...(documentTitle !== undefined ? { documentTitle } : {})}
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
                        header && (
                          <>
                            <LabHeader {...(addTrial !== undefined ? { addTrial } : {})} />
                            {zoom && !presenting ? <LabZoom /> : null}
                            {children}
                            <LabHeaderRegion contributions={labChromeAll} />
                            <LabThemeSwitcher />
                          </>
                        )
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
        </AnnotationPreloadContext.Provider>
      </PersistenceContext.Provider>
    </LabProviders>
  );
}
