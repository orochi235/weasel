import { ThemeProvider } from '@weasel-js/theme/react';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStore } from 'zustand/react';
import { AnnotationPreloadContext } from '../annotations/preload';
import type { TrialContribution } from '../chrome/types';
import type { ConfigRule, ControlRenderer } from '../config/types';
import { configDefaultsOf, serializersOf } from '../instrument/serializers';
import type { InstrumentList } from '../instrument/types';
import { defaultStorage, noneAdapter } from '../state/adapters';
import { LabStoreContext } from '../state/context';
import { type OpenedLabStore, openLabStore } from '../state/openLabStore';
import { PersistenceContext } from '../state/Persistence';
import { createRecordCache } from '../state/records';
import { createLabStore, type LabStore } from '../state/store';
import type { LabMode, StorageAdapter, TrialRecord } from '../state/types';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
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
} from '../trial/trialOps';
import { LabContext, type LabContextValue } from './LabContext';
import { LabHeader } from './LabHeader';
import { LabPalette } from './LabPalette';
import { LabShell } from './LabShell';
import type { LabPage } from './LabSwitcher';
import { createPanelHostRegistry, PanelHostContext } from './panelHost';
import { useResolvedMode } from './useSystemMode';
import { type PanelDescriptor, type TrialLayout, Workspace } from './Workspace';

interface LabBaseProps {
  instruments: InstrumentList;
  defaultInstrument: string;
  mode?: LabMode;
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
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
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
  const store = createLabStore({
    initialMode: mode ?? 'auto',
    serializers: serializersOf(instruments),
    configDefaults: configDefaultsOf(instruments),
  });
  seedDefaultTrial(store, instruments, defaultInstrument);
  const records = createRecordCache({ storage: noneAdapter, prefix: '', writable: false });
  return { store, records, close: () => records.close(), marks: new Map() };
}

async function openStoredLab(
  { instruments, defaultInstrument, mode }: LabProps,
  storageKey: string,
  storage: StorageAdapter | undefined,
): Promise<OpenedLab> {
  // The store reads the serializers and defaults while it is being built, so
  // they go in with it rather than being registered onto it afterwards.
  const opened = await openLabStore({
    storageKey,
    storage: storage ?? (await defaultStorage()),
    initialMode: mode ?? 'auto',
    serializers: serializersOf(instruments),
    configDefaults: configDefaultsOf(instruments),
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
  pages,
  path,
}: Pick<LabBaseProps, 'title' | 'mode' | 'pages' | 'path'>) {
  const resolvedMode = useResolvedMode(mode ?? 'auto');
  return (
    <ThemeProvider theme={interstellarTheme} mode={resolvedMode} className="lk-lab">
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
    return props.fallback !== undefined ? (
      <>{props.fallback}</>
    ) : (
      <LabFallback title={props.title} mode={props.mode} pages={props.pages} path={props.path} />
    );
  }
  return <LabRuntime {...props} opened={opened} />;
}

function LabRuntime({
  instruments,
  mode,
  nebula,
  title,
  pages,
  path,
  footer,
  chrome,
  suppress,
  tools,
  configRules,
  controls,
  children,
  opened,
}: LabProps & { opened: OpenedLab }) {
  const { store } = opened;

  const trials = useStore(store, (s) => s.trials);
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
  // rects compose against it, and every tile paints into the one buffer.
  // `Workspace` invalidates rects when the grid moves something a
  // ResizeObserver cannot see. A host that already owns a surface keeps it: a
  // lab embedded in a larger shared-surface app must not open a second GL
  // tenancy, and mounts no buffer of its own.
  const outerSurface = useSurfaceOptional();
  const outerCanvas = useSurfaceCanvas();
  const [ownCanvas, setOwnCanvas] = useState<HTMLCanvasElement | null>(null);
  const ownCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef({ w: 0, h: 0 });
  const surfaceRef = useRef<ReturnType<typeof useTiledSurface> | null>(null);

  // Sizing the buffer clears all of it, so every tile has to repaint — not
  // only the one whose move triggered the measurement.
  const onFrame = useCallback((frame: SurfaceFrame) => {
    const c = ownCanvasRef.current;
    if (!c) return;
    const w = Math.round(frame.size.width * frame.dpr);
    const h = Math.round(frame.size.height * frame.dpr);
    if (bufferRef.current.w !== w || bufferRef.current.h !== h) {
      bufferRef.current = { w, h };
      c.width = w;
      c.height = h;
      c.style.width = `${frame.size.width}px`;
      c.style.height = `${frame.size.height}px`;
      surfaceRef.current?.invalidateAll();
      return;
    }
    // A same-size re-tile does not go through here: assigning `width` its own
    // value resizes nothing, so it clears nothing. The tenants clear, through
    // `registerClear`.
  }, []);

  const ownSurface = useTiledSurface({ onFrame });
  surfaceRef.current = ownSurface;
  const surface = outerSurface ?? ownSurface;
  const surfaceCanvas = outerSurface ? outerCanvas : ownCanvas;

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

    return {
      instruments,
      trials,
      addTrial: (instrumentName, options) => {
        const next = addTrialOp(store.getState().trials, instruments, instrumentName, options);
        replaceTrials(next);
      },
      cloneTrial: (id) => {
        const next = cloneTrialOp(store.getState().trials, id);
        replaceTrials(next);
      },
      closeTrial: (id) => {
        const next = closeTrialOp(store.getState().trials, id);
        replaceTrials(next);
      },
      reorderTrials: (ids) => {
        replaceTrials(reorderTrialsOp(store.getState().trials, ids));
      },
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
  }, [instruments, trials, savedSnapshots, modeValue, store, configRules, controls]);

  // Only override the backdrop in dark, where there is one to override.
  // Setting a CSS custom property is the sanctioned use of inline style.
  const backdropStyle =
    resolvedMode === 'dark' && nebula && nebula.length > 0
      ? ({ ['--wzl-backdrop' as string]: buildNebula(nebula) } as CSSProperties)
      : undefined;

  return (
    <LabStoreContext.Provider value={{ store }}>
      <PersistenceContext.Provider value={opened.records}>
        <AnnotationPreloadContext.Provider value={opened.marks}>
          <LabContext.Provider value={contextValue}>
            <ThemeProvider
              theme={interstellarTheme}
              mode={resolvedMode}
              className="lk-lab"
              style={backdropStyle}
            >
              <LabShell
                title={title ?? 'Labkit'}
                mode={modeValue}
                {...(pages ? { pages } : {})}
                {...(path !== undefined ? { path } : {})}
                footer={footer}
                header={
                  <>
                    <LabHeader />
                    {children}
                  </>
                }
              >
                <PanelHostContext.Provider value={panelHostsRef.current}>
                  <SurfaceContext.Provider value={surface}>
                    <SurfaceCanvasContext.Provider value={surfaceCanvas}>
                      <div
                        className="lk-lab__body"
                        ref={outerSurface ? undefined : ownSurface.containerRef}
                      >
                        {outerSurface ? null : (
                          // Above the trials and inert: the marks a tile paints have
                          // to sit over the instrument's own DOM, and nothing on this
                          // buffer takes input — each tile has its own input box.
                          <canvas
                            className="lk-lab__surface"
                            ref={(el) => {
                              ownCanvasRef.current = el;
                              setOwnCanvas(el);
                            }}
                          />
                        )}
                        {tools ? <LabPalette tools={tools} /> : null}
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
