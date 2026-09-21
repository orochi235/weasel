import { ThemeProvider } from '@weasel-js/theme/react';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStore } from 'zustand/react';
import { AnnotationPreloadContext } from '../annotations/preload';
import { ANNOTATION_TOOLS } from '../annotations/toolMap';
import {
  LabAsideRegion,
  LabFooterRegion,
  LabHeaderRegion,
  LabSidebarRegion,
  labContributions,
} from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import type { TrialContribution } from '../chrome/types';
import type { ConfigRule, ControlRenderer } from '../config/types';
import type { InstrumentList } from '../instrument/types';
import { Split } from '../primitives/Split';
import { defaultStorage, noneAdapter } from '../state/adapters';
import { LabStoreContext } from '../state/context';
import { type OpenedLabStore, openLabStore } from '../state/openLabStore';
import { PersistenceContext } from '../state/Persistence';
import { createRecordCache } from '../state/records';
import { createLabStore, type LabStore } from '../state/store';
import type { LabDensity, LabMode, StorageAdapter, TrialRecord } from '../state/types';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
import { usePersistedState } from '../state/usePersistedState';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { useSurfaceCanvas, useSurfaceOptional } from '../surface/useSurfaceTile';
import { type SurfaceFrame, useTiledSurface } from '../surface/useTiledSurface';
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
import { LabHeader } from './LabHeader';
import { LabPalette } from './LabPalette';
import { LabShell } from './LabShell';
import type { LabPage } from './LabSwitcher';
import { createPanelHostRegistry, PanelHostContext } from './panelHost';
import { useResolvedMode } from './useSystemMode';
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
  /** Rendered while a stored lab loads. Default: the lab's empty shell. */
  fallback?: ReactNode;
  /**
   * Optional list of CSS colors used to compose the interstellar theme's
   * cosmic backdrop. Each color becomes one radial-gradient blob on the
   * dark void base. Order maps to a fixed spread of positions; extras wrap
   * around. Ignored unless the resolved mode is dark.
   */
  nebula?: readonly string[];
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
  /** Offer the header's add-trial control. Default `true`; a lab that opens
   *  trials some other way passes `false`. */
  addTrial?: boolean;
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
}

/** Props for `<Lab>`. With a `storageKey` the lab persists — to IndexedDB
 *  unless `storage` names another substrate — and both are read once, at
 *  mount. Without one, nothing persists. */
export type LabProps = LabBaseProps &
  (
    | { storageKey?: undefined; storage?: undefined }
    | { storageKey: string; storage?: StorageAdapter }
  );

interface OpenedLab extends OpenedLabStore {
  marks: ReadonlyMap<string, unknown>;
}

function seedDefaultTrial(
  store: LabStore,
  instruments: InstrumentList,
  defaultInstrument: string,
): void {
  if (store.getState().trials.length > 0) return;
  const record = addTrialOp([], instruments, defaultInstrument)[0];
  if (!record) return;
  const { undoStack: _undoStack, ...rest } = record;
  store.getState().addTrial(rest);
}

/** A lab with nothing to load renders at once. Its records hold
 *  `usePersistedState` values for the session and write nothing. */
function openUnstoredLab({ instruments, defaultInstrument, mode }: LabProps): OpenedLab {
  const store = createLabStore({ initialMode: mode ?? 'auto', instruments });
  seedDefaultTrial(store, instruments, defaultInstrument);
  const records = createRecordCache({ storage: noneAdapter, prefix: '', writable: false });
  return { store, records, close: () => records.close(), marks: new Map() };
}

async function openStoredLab(
  { instruments, defaultInstrument, mode }: LabProps,
  storageKey: string,
  storage: StorageAdapter | undefined,
): Promise<OpenedLab> {
  // The store reads the instruments' serializers and defaults while it is being
  // built, so they go in with it rather than being pushed onto it afterwards.
  const opened = await openLabStore({
    storageKey,
    storage: storage ?? (await defaultStorage()),
    initialMode: mode ?? 'auto',
    instruments,
  });
  seedDefaultTrial(opened.store, instruments, defaultInstrument);
  const marks = new Map<string, unknown>();
  await Promise.all(
    opened.store.getState().trials.map(async (trial) => {
      const kept = instruments.find((i) => i.name === trial.instrumentName)?.annotations?.storage;
      if (!kept) return;
      try {
        marks.set(trial.id, await kept.load());
      } catch (error) {
        console.warn(`[labkit] could not load the marks of trial "${trial.id}"`, error);
        marks.set(trial.id, null);
      }
    }),
  );
  return { ...opened, marks };
}

function LabFallback({
  title,
  mode,
  density,
  pages,
  path,
}: Pick<LabBaseProps, 'title' | 'mode' | 'density' | 'pages' | 'path'>) {
  const resolvedMode = useResolvedMode(mode ?? 'auto');
  return (
    <ThemeProvider
      theme={interstellarTheme}
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

// Fixed spread of nebula blob positions / sizes / fall-off stops. Colors
// supplied via the `nebula` prop are slotted into these slots in order;
// callers passing more than 5 wrap around (intentional — keeps the look
// readable and bounded).
const NEBULA_SLOTS = [
  { cx: '18%', cy: '30%', sx: '60%', sy: '80%', stop: '70%' },
  { cx: '78%', cy: '70%', sx: '55%', sy: '90%', stop: '65%' },
  { cx: '50%', cy: '50%', sx: '50%', sy: '70%', stop: '75%' },
  { cx: '12%', cy: '82%', sx: '50%', sy: '70%', stop: '70%' },
  { cx: '85%', cy: '18%', sx: '55%', sy: '80%', stop: '70%' },
] as const;

function buildNebula(colors: readonly string[]): string {
  const blobs = colors.map((c, i) => {
    const p = NEBULA_SLOTS[i % NEBULA_SLOTS.length];
    return `radial-gradient(ellipse ${p.sx} ${p.sy} at ${p.cx} ${p.cy}, color-mix(in srgb, ${c} 22%, transparent), transparent ${p.stop})`;
  });
  blobs.push('radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)');
  return blobs.join(', ');
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
  const { storageKey, storage } = props;
  useWarnIgnoredChange('<Lab>', { storageKey, storage });
  const opened = useOpenOnce<OpenedLab>(() =>
    storageKey === undefined ? openUnstoredLab(props) : openStoredLab(props, storageKey, storage),
  );
  if (!opened) {
    if (props.fallback !== undefined) return props.fallback;
    return (
      <LabFallback
        title={props.title}
        mode={props.mode}
        density={props.density}
        pages={props.pages}
        path={props.path}
      />
    );
  }
  return <LabRuntime {...props} opened={opened} />;
}

function LabRuntime({
  instruments,
  mode,
  density,
  nebula,
  title,
  pages,
  path,
  footer,
  chrome,
  labChrome,
  suppress,
  addTrial,
  tools,
  configRules,
  controls,
  children,
  opened,
}: LabProps & { opened: OpenedLab }) {
  const { store } = opened;

  // The store opened against the list <Lab> mounted with; a later list reaches
  // it here, before paint.
  useLayoutEffect(() => {
    store.getState().setInstruments(instruments);
  }, [instruments, store]);

  const trials = useStore(store, (s) => s.trials);
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

  // One shared drawing surface for the whole lab, anchored to the body — tile
  // rects compose against it, and both buffers compose against the same rects.
  // `Workspace` invalidates rects when the grid moves something a
  // ResizeObserver cannot see. A host that already owns a surface keeps it: a
  // lab embedded in a larger shared-surface app must not open a second GL
  // tenancy, and mounts no buffer of its own.
  const outerSurface = useSurfaceOptional();
  const outerOver = useSurfaceCanvas('over');
  const outerUnder = useSurfaceCanvas('under');
  const [ownOver, setOwnOver] = useState<HTMLCanvasElement | null>(null);
  const [ownUnder, setOwnUnder] = useState<HTMLCanvasElement | null>(null);
  const ownOverRef = useRef<HTMLCanvasElement | null>(null);
  const ownUnderRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef({ w: 0, h: 0 });
  const surfaceRef = useRef<ReturnType<typeof useTiledSurface> | null>(null);

  // Sizing the buffer clears all of it, so every tile has to repaint — not
  // only the one whose move triggered the measurement. Both buffers are sized
  // together off one comparison: they are the same box, so a tenant of either
  // is looking at the same rects, and one invalidateAll covers both.
  const onFrame = useCallback((frame: SurfaceFrame) => {
    const canvases = [ownUnderRef.current, ownOverRef.current].filter((c) => c !== null);
    if (canvases.length === 0) return;
    const w = Math.round(frame.size.width * frame.dpr);
    const h = Math.round(frame.size.height * frame.dpr);
    if (bufferRef.current.w !== w || bufferRef.current.h !== h) {
      bufferRef.current = { w, h };
      for (const c of canvases) {
        c.width = w;
        c.height = h;
        c.style.width = `${frame.size.width}px`;
        c.style.height = `${frame.size.height}px`;
      }
      surfaceRef.current?.invalidateAll();
      return;
    }
    // A same-size re-tile does not go through here: assigning `width` its own
    // value resizes nothing, so it clears nothing. The tenants clear, through
    // `registerClear`.
  }, []);

  const ownSurface = useTiledSurface({ onFrame });
  surfaceRef.current = ownSurface;
  const [labBody, setLabBody] = useState<HTMLDivElement | null>(null);
  const attachOwnSurface = ownSurface.containerRef;
  const labBodyRef = useCallback(
    (el: HTMLDivElement | null) => {
      setLabBody(el);
      if (!outerSurface) attachOwnSurface(el);
    },
    [outerSurface, attachOwnSurface],
  );
  useLabFitWarning(labBody);

  useEffect(() => {
    if (!labBody) return;
    const pick = (node: unknown): void => {
      const owned = new Set(store.getState().trials.map((t) => t.id));
      const nearest = (from: Element | null | undefined) =>
        from?.closest<HTMLElement>('.lk-trial[data-trial-id]') ?? null;
      let trial =
        typeof (node as Element | null)?.closest === 'function' ? nearest(node as Element) : null;
      // A trial can hold a lab of its own, whose trials this lab does not own.
      while (trial && !owned.has(trial.dataset.trialId ?? '')) trial = nearest(trial.parentElement);
      if (trial?.dataset.trialId) setFocusPick(trial.dataset.trialId);
    };
    const onInput = (event: Event): void => pick(event.target);
    // Focus moving into a frame fires nothing in this document: the window
    // blurs, and the frame is the active element once it has.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const doc = labBody.ownerDocument;
    const win = doc.defaultView;
    const onBlur = (): void => {
      clearTimeout(pending);
      pending = setTimeout(() => pick(doc.activeElement), 0);
    };
    labBody.addEventListener('pointerdown', onInput, true);
    labBody.addEventListener('focusin', onInput, true);
    win?.addEventListener('blur', onBlur);
    return () => {
      clearTimeout(pending);
      labBody.removeEventListener('pointerdown', onInput, true);
      labBody.removeEventListener('focusin', onInput, true);
      win?.removeEventListener('blur', onBlur);
    };
  }, [labBody, store]);
  const surface = outerSurface ?? ownSurface;
  const surfaceCanvases = useMemo(
    () =>
      outerSurface ? { over: outerOver, under: outerUnder } : { over: ownOver, under: ownUnder },
    [outerSurface, outerOver, outerUnder, ownOver, ownUnder],
  );

  const workspacePanels = useMemo<PanelDescriptor[]>(
    () =>
      Object.entries(undockedPanels).map(([key, panel]) => ({
        key,
        title: panel.sectionId,
        as: panel.as,
      })),
    [undockedPanels],
  );
  const resolvedMode = useResolvedMode(modeValue);

  // Tools and lab contributions share one id namespace, so they merge once
  // here — before any region renders — and a collision throws rather than one
  // of them silently losing.
  // Declaring `annotations` on any instrument puts the drawing tools here, in
  // the lab's rail: one tool is armed across every trial.
  const annotates = instruments.some((i) => i.annotations != null);
  const labChromeAll = useMemo(
    () => labContributions([...(annotates ? ANNOTATION_TOOLS : []), ...(tools ?? [])], labChrome),
    [annotates, tools, labChrome],
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
    resolvedMode === 'dark' && nebula && nebula.length > 0
      ? ({ ['--wzl-backdrop' as string]: buildNebula(nebula) } as CSSProperties)
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
            <ThemeProvider
              theme={interstellarTheme}
              selection={{ mode: resolvedMode, density: density ?? 'comfortable' }}
              className="lk-lab"
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
                    {children}
                    <LabHeaderRegion contributions={labChromeAll} />
                  </>
                }
              >
                <PanelHostContext.Provider value={panelHostsRef.current}>
                  <SurfaceContext.Provider value={surface}>
                    <SurfaceCanvasContext.Provider value={surfaceCanvases}>
                      <div className="lk-lab__body" ref={labBodyRef}>
                        {outerSurface ? null : (
                          // Two buffers stacked around the trials, both inert —
                          // each tile takes input from its own box. A tile's marks
                          // annotate the instrument's DOM from over it; an opaque
                          // renderer sits under it, so the pane can still hold a
                          // label. The under one is first so it paints first.
                          <>
                            <canvas
                              className="lk-lab__surface lk-lab__surface--under"
                              ref={(el) => {
                                ownUnderRef.current = el;
                                setOwnUnder(el);
                              }}
                            />
                            <canvas
                              className="lk-lab__surface lk-lab__surface--over"
                              ref={(el) => {
                                ownOverRef.current = el;
                                setOwnOver(el);
                              }}
                            />
                          </>
                        )}
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
                      </div>
                    </SurfaceCanvasContext.Provider>
                  </SurfaceContext.Provider>
                </PanelHostContext.Provider>
              </LabShell>
            </ThemeProvider>
          </LabContext.Provider>
        </AnnotationPreloadContext.Provider>
      </PersistenceContext.Provider>
    </LabStoreContext.Provider>
  );
}
