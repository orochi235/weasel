/**
 * WeaselDraw — minimum-viable editor built against the post-purge kit
 * surface.
 *
 * Shape:
 *   - `<SceneCanvas features={['draw']} defaultTools={BUILTIN_TOOL_IDS}>` provides every built-in tool
 *     (select / hand / rect / ellipse / line / polygon / star / pencil /
 *     lasso / text / clone) plus the resize / rotate affordances.
 *   - `useScene` owns the document tree; pose is `{x,y,width,height,rotation?}`
 *     and data is the kit-native `{path, fill, stroke?, text?}`
 *     shape consumed by PATH_PAINTER / kit:text. Both are what the bundled
 *     shape-tool `create` defaults already produce, so no per-tool overrides.
 *   - The Actions Registry (auto-mounted by SceneCanvas via
 *     `useStandardActions`) handles undo/redo, delete, duplicate, nudge,
 *     align/distribute, reorder, flip, group/ungroup, clipboard. The
 *     CommandBar renders them from the registry; the keyboard reaches them
 *     through the dispatcher.
 *   - `<ColorContextProvider>` holds the active fill/stroke; selection
 *     mutations go through `scene.update` so they're undoable.
 *   - `<CommandBar>` takes handlers only for draw's own buttons — file,
 *     view toggles, preferences.
 *   - `<ActiveSwatches>` is the fill/stroke widget; clicks open a native
 *     color picker via the existing component implementation.
 *   - Local-storage round-trip: the scene and its undo stacks are saved 300 ms
 *     after each change by an effect in `App`.
 */
import {
  ActiveToolContextProvider,
  asNodeId,
  buildSceneViewCommands,
  BUILTIN_TOOL_IDS,
  contrastLineColor,
  DEFAULT_STROKE_COLOR,
  defaultCommitAdapter,
  defaultDrawOne,
  fitViewToBounds,
  type RangeStyle,
  type RenderLayer,
  SceneCanvas,
  type SceneCanvasApi,
  type ToolsApi,
  transformPath,
  useActionsRegistry,
  useCanvasSize,
  useLatest,
  useScene,
  useSceneTextEdit,
  useSelection,
  type View,
  workspaceTintLayer
} from '@weasel-js/core';
import { createGridLayer, gridSnapStrategy } from '@weasel-js/guides';
import { useHudContribution } from '@weasel-js/hud/react';
import {
  createRecentColorsStore,
  RecentColorsProvider,
  ResizeHandle,
  SceneGradientHandles,
  Sidebar,
  ToolPalette
} from '@weasel-js/ui';
import {
  type CSSProperties,
  type ReactElement,
  useCallback, useEffect, useMemo, useRef, useState
} from 'react';

import type { SceneCanvasHit } from '@weasel-js/core';
import { effectiveRangeStyle, patchRangeStyle, useSliceTool } from '@weasel-js/core';
import { unpackSvgFiles } from '@weasel-js/svg';
import { type ActivePaint, ActiveSwatches } from './ActiveSwatches';
import type { PaperSizeKey } from './CommandBar';
import { LoupeControls } from './LoupeControls';
import { PreferencesModal } from './PreferencesModal';
import { type AppCommands, appCommandsContribution } from './appCommands';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { loadDoc, PAPER_PRESETS, saveDoc } from './docPersistence';
import { disableMachineFontOutlines, enableMachineFontOutlines } from './fonts';
import { dispatchDoubleClickEntry, modalityShortcuts } from './modality';
import { ModeBreadcrumb } from './modality/chrome/ModeBreadcrumb';
import { useModality } from './modality/useModality';
import { OpacityHud } from './opacityScrub/OpacityHud';
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { clipboardJsonReviver, serializeReplacer } from './persistence';
import { PREFS, usePref } from './prefs';
import { hasCompoundPath, releaseCompoundPaths } from './releaseCompound';
import { writeSession } from './sessionStore';
import { colorContribution, useColorContext } from './tools/colorContext';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { CharacterOptions, TextEditDepPublisher } from './ui/CharacterOptions';

// Bounds for the sidebar drag come from the pref that stores the result, so
// the handle and the Preferences number field can't drift apart. app.css
// clamps to the same numbers as a backstop.
const RIGHT_SIDEBAR_MIN = PREFS.children.ui.children.rightSidebarWidth.min;
const RIGHT_SIDEBAR_MAX = PREFS.children.ui.children.rightSidebarWidth.max;

import { EditorStatusBar, useModeId } from './EditorStatusBar';
import { RightSidebar } from './RightSidebar';
import { Toolbar } from './Toolbar';
import { BooleansAdapterPublisher, CreateOutlinesAdapterPublisher } from './adapterPublishers';
import './app.css';
import { DRAW_POSE_COMPOSITION, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { TEXT_CHROME_CLASS } from './paintRenderers';
import { HISTORY_KEY, loadHistory, loadInitial, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

// ─── Document / scene shapes ────────────────────────────────────────────────
/** The grid's pitch in world units: what the grid layer draws and what snap rounds to. */
const GRID_SPACING = 20;
const RECENT_COLORS_KEY = 'weaseldraw:recent-colors';

// Draw's full ingestion config: SVG unpack + clipboard revival.
// OS-dropped / pasted SVG files import as real scene nodes (the kit's
// `unpack` path) rather than a single embedded-image node — WeaselDraw's
// leaf data IS the kit-native `{path, fill, stroke}` painter shape, so
// unpacked nodes render and edit like any other object. `clipboard.reviver`
// revives typed-array node data (Uint8Array/Float32Array path commands)
// carried by weasel-JSON clipboard payloads — via `clipboardJsonReviver`,
// the JSON-reviver adapter over the same `reviveSnapshot` walk that scene
// persistence uses (the walker itself is NOT `(key, value)`-shaped; see
// persistence.ts). Module const: SceneCanvas keys its dep wiring off the
// prop identity.
const DRAW_INGESTION = { svg: { unpack: unpackSvgFiles }, clipboard: { reviver: clipboardJsonReviver } };
/** Seed fill for a fresh document. Intentionally a friendly blue rather than
 *  the kit's white `DEFAULT_FILL_COLOR` — a new shape lands visible against
 *  the white page instead of disappearing into it. Keep distinct from the
 *  kit default on purpose. */
const INITIAL_FILL_COLOR = '#7ab8d4ff';
// ─── Right sidebar: LayerList + SelectionPanel ──────────────────────────────
// ─── Modality helpers ────────────────────────────────────────────────────────
// ─── Helpers ────────────────────────────────────────────────────────────────
// ─── Outer App: install the color context so swatches + actions resolve ─────

export function App(): ReactElement {
  const [initialScene] = useState(loadInitial);
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    initial: initialScene,
  });
  const selection = useSelection({ mode: 'multi', scene });

  // Bootstrap the mode machine, decorations, and scoping dim. useModality
  // wires the journal accessor on the scene via
  // `scene.setActiveJournalAccessor` once the machine is constructed —
  // no ref dance needed at this layer.
  const modality = useModality(scene);

  // Restored external-op history entries (nudges, drags, action commits)
  // replay against this adapter after a reload. `defaultCommitAdapter` is the
  // same scene-backed adapter the default actions bind at live commit time —
  // it carries the scene-owned op-apply surface, where the canvas adapter
  // lacks `setData` and `setLayer` (a restored nudge's geometry-projection
  // setData op would fail against it). Lazy accessor: wiring order vs the
  // boot-time restoreHistory doesn't matter.
  useEffect(() => {
    const a = defaultCommitAdapter(scene);
    scene.setHistoryAdapter(() => a);
    return () => scene.setHistoryAdapter(null);
  }, [scene]);

  // Restore the persisted undo stacks once on mount (modality history, then
  // the scene's own history). Scene state is already in place — it's restored
  // synchronously at scene construction via `initial: loadInitial()` — so the
  // restored entries' inverts land on the correct adapter state. `restoredRef`
  // then unblocks the persist effect so it can't clobber the saved history
  // with the empty initial stack first.
  const restoredRef = useRef(false);
  useEffect(() => {
    const snap = loadHistory();
    if (snap) modality.history.restore(snap);
    const sceneSnap = loadSceneHistory();
    if (sceneSnap) {
      try {
        scene.restoreHistory(sceneSnap);
      } catch {
        // A parseable-but-malformed snapshot must not wedge every boot:
        // drop it and start with an empty undo stack.
        try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
      }
    }
    restoredRef.current = true;
    // Run once; scene/modality are stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every commit. The 300ms debounce coalesces drag bursts so
  // we hit localStorage at most a few times per second. Scene and history go
  // under separate keys (mirroring the doc key) so a shape migration of one
  // never disturbs the other. A page going away mid-debounce writes at once.
  const pendingSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const save = (): void => {
      pendingSaveRef.current = null;
      if (!restoredRef.current) return;
      try {
        writeSession(
          localStorage,
          [LS_KEY, JSON.stringify(scene.toJSON(), serializeReplacer)],
          [
            [HISTORY_KEY, JSON.stringify(modality.history.serialize(), serializeReplacer)],
            [SCENE_HISTORY_KEY, JSON.stringify(scene.serializeHistory(), serializeReplacer)],
          ],
        );
      } catch {
        // Persistence is best-effort.
      }
    };
    pendingSaveRef.current = save;
    const id = setTimeout(save, 300);
    return () => clearTimeout(id);
  });
  useEffect(() => {
    const flush = (): void => pendingSaveRef.current?.();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const [recentColors] = useState(() => createRecentColorsStore({ key: RECENT_COLORS_KEY }));
  const initialFill: ActivePaint = { kind: 'solid', color: INITIAL_FILL_COLOR };
  const initialStroke: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

  return (
    <RecentColorsProvider store={recentColors}>
      <ColorContextProvider
        initialFill={initialFill}
        initialStroke={initialStroke}
      >
        <EditorWithSharedScene scene={scene} selection={selection} modality={modality} />
      </ColorContextProvider>
    </RecentColorsProvider>
  );
}

// ─── Editor variant that consumes the lifted scene/selection ────────────────

function EditorWithSharedScene({
  scene,
  selection,
  modality,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  modality: ReturnType<typeof useModality>;
}): ReactElement {
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const actionsReg = useActionsRegistry();
  const colors = useColorContext();
  // On-canvas gradient handles edit one node's one paint; which paint is the
  // side the swatches have focus on.
  const selectedIds = selection.get();
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const [initialDoc] = useState(loadDoc);
  const [paperSize, setPaperSize] = useState<PaperSizeKey>(initialDoc.paperSize);
  const [gridVisible, setGridVisible] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Right-sidebar width. The pref is the durable value; `dragWidth` shadows it
  // for the duration of a drag so a pointer-rate stream of samples doesn't
  // schedule a prefs write per frame. Cleared on commit, which hands ownership
  // back to the pref in the same render.
  const [prefWidth, setPrefWidth] = usePref('ui.rightSidebarWidth');
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  // Machine-font outlines. The switch is the user gesture the permission
  // prompt needs; on a later load the pref is already on and, with permission
  // granted, `queryLocalFonts` resolves without prompting again.
  const [machineOutlines, setMachineOutlines] = usePref('text.machineFontOutlines');
  useEffect(() => {
    if (!machineOutlines) {
      disableMachineFontOutlines();
      return;
    }
    void enableMachineFontOutlines().catch((err: unknown) => {
      // A refusal is the user's answer, so put the switch back to match it.
      // Anything else — no API in this browser, a transient failure — leaves
      // the preference alone: it is a standing wish that costs nothing to
      // keep, and flipping it off would make the user re-express it on a
      // browser that might support this next time.
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setMachineOutlines(false);
        return;
      }
      console.warn('WeaselDraw: machine-font outlines unavailable —', err);
    });
  }, [machineOutlines, setMachineOutlines]);
  const rightWidth = dragWidth ?? prefWidth;
  const commitRightWidth = useCallback((next: number) => {
    setPrefWidth(next);
    setDragWidth(null);
  }, [setPrefWidth]);

  // Document-level state, persisted alongside the scene under a separate LS
  // key so a doc-shape migration doesn't have to touch the scene snapshot.
  const [filename, setFilename] = useState<string>(initialDoc.filename);
  const [backgroundColor, setBackgroundColor] = useState<string>(initialDoc.backgroundColor);
  const [docSelected, setDocSelected] = useState<boolean>(false);

  // Doc-target selection is mutually exclusive with scene-node selection.
  // Whenever the kit selection becomes non-empty, drop the doc-target flag
  // so the Properties panel reverts to node properties.
  if (selection.current.length > 0 && docSelected) setDocSelected(false);

  // Persist the document with the same 300ms debounce as the scene.
  useEffect(() => {
    const id = setTimeout(() => saveDoc({ filename, backgroundColor, paperSize }), 300);
    return () => clearTimeout(id);
  }, [filename, backgroundColor, paperSize]);

  // ── Mode id + breadcrumb state ────────────────────────────────────────────
  const modeId = useModeId(modality.machine);

  // Re-read on every render; `modeId` changing is what re-renders us, and the
  // resolved id is a tighter memo key than the mode it came from.
  const activeTargetId = modality.machine.getActiveTargetId();
  const targetLabel = useMemo(() => {
    const tid = activeTargetId;
    if (!tid) return null;
    // Look up the node's display label from scene data; fall back to the id.
    const node = scene.get(asNodeId(tid));
    if (node) {
      const data = node.data as WeaselDrawData;
      return data.label ?? data.text ?? tid;
    }
    return tid;
  }, [activeTargetId, scene]);

  // Leaving a mode rides the dispatcher: each mode's declared shortcuts,
  // gated on that mode.
  const pathEditEntry = useLatest({
    pathToEdit: (): string | null => {
      const [id, ...rest] = selection.get();
      if (id === undefined || rest.length > 0) return null;
      return (scene.get(id)?.data as { path?: unknown } | undefined)?.path != null ? id : null;
    },
    startPathEdit: (): void => { actionsReg?.trigger('enterPathEdit'); },
  });
  const modalityKeys = useMemo(() => modalityShortcuts(modality.machine, {
    pathToEdit: () => pathEditEntry.current.pathToEdit(),
    startPathEdit: () => pathEditEntry.current.startPathEdit(),
  }), [modality.machine, pathEditEntry]);

  // ── Modality SceneCanvas callbacks ────────────────────────────────────────
  const onDoubleClick = useCallback((hit: SceneCanvasHit | null) => {
    dispatchDoubleClickEntry(hit, modality.machine);
  }, [modality.machine]);

  // TODO(modality): wire non-normal-mode background-click composition
  // (text-edit commit, isolation scoped-clear) through `handleBackgroundClick`
  // from `./modality` once we have a non-leaky hook into the dispatcher.
  // SceneCanvas's `onBackgroundClick` prop is intentionally omitted because
  // it would race with the gesture-dispatcher channel (marquee, lasso). For
  // normal mode the select tool's `clearSelection` action already handles
  // background clicks; soft modes exit via Esc and strict modes via the
  // breadcrumb's commit/cancel buttons in the interim.

  const paper = PAPER_PRESETS[paperSize];

  // Workspace host: the canvas fills the entire `.wd-canvas-host` area
  // (diagonal stripes); the document page is drawn as a world-space layer.
  // Track host CSS dims so we can size the canvas + fit the page on mount /
  // paper-size change.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hostDims = useCanvasSize(hostRef);

  // Lifted view state (controlled SceneCanvas). Refit-to-page runs on initial
  // host-dims sample and on every paperSize change; we deliberately do NOT
  // refit on subsequent host resizes — that would hijack the user's pan/zoom.
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const lastFitPaperRef = useRef<PaperSizeKey | null>(null);
  // Stable recenter thunk wired into SceneCanvas.viewport.recenter so Cmd-0
  // refits the page into the workspace. Reads live host dims + paper size
  // through refs so the callback identity stays constant for SceneCanvas.
  const hostDimsRef = useLatest(hostDims);
  const paperRef = useLatest(paper);
  const recenter = useCallback(() => {
    const dims = hostDimsRef.current;
    if (dims.width === 0 || dims.height === 0) return;
    const p = paperRef.current;
    setView(fitViewToBounds(
      { x: 0, y: 0, width: p.width, height: p.height },
      dims,
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      { padding: 24 },
    ));
  }, [hostDimsRef, paperRef]);
  useEffect(() => {
    if (hostDims.width === 0 || hostDims.height === 0) return;
    if (lastFitPaperRef.current === paperSize) return;
    lastFitPaperRef.current = paperSize;
    recenter();
  }, [paperSize, hostDims.width, hostDims.height, paper.width, paper.height, recenter]);

  // Document-page layer — a single world-space rect at {0,0,paper.width,paper.height}
  // filled with the doc's backgroundColor. Replaces the kit-level backgroundFill
  // (which painted the entire canvas), so the workspace stripes show everywhere
  // outside the page.
  const paperLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'paper',
    label: 'Paper',
    // World-space commands; drawLayers wraps in viewToMat3 automatically.
    draw: () => [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: paper.width, height: paper.height },
      fill: { fill: 'solid', color: backgroundColor },
    }],
  }), [paper.width, paper.height, backgroundColor]);

  // What the loupe magnifies: the page and the scene on top of it, the same
  // two the canvas paints. The page layer goes in as itself — the loupe draws
  // its sources through `drawOneLayer`, so a world-space one gets the lens's
  // inner view. The scene half projects inside `buildSceneViewCommands`, which
  // is what `space: 'screen'` says about it.
  const loupeSource = useMemo<RenderLayer<unknown>[]>(() => [
    paperLayer,
    {
      id: 'loupe-scene',
      label: 'Loupe scene',
      space: 'screen',
      draw: (_data, v) => buildSceneViewCommands(scene, v, defaultDrawOne),
    },
  ], [paperLayer, scene]);

  const hudTool = useHudContribution();
  const colorsRef = useLatest(colors);
  const colorKeys = useMemo(() => colorContribution(() => colorsRef.current), [colorsRef]);
  const appCommands: AppCommands = {
    gridVisible,
    toggleGrid: () => setGridVisible(!gridVisible),
    snapToGrid,
    toggleSnap: () => setSnapToGrid(!snapToGrid),
    canReleaseCompound: hasCompoundPath(scene, selection.current),
    releaseCompound: () => selection.set(releaseCompoundPaths(scene, selection.current)),
    openPrefs: () => setPrefsOpen(true),
  };
  const appCommandsRef = useLatest(appCommands);
  const appKeys = useMemo(() => appCommandsContribution(() => appCommandsRef.current), [appCommandsRef]);
  const ambient = useMemo(
    () => [hudTool, modalityKeys, colorKeys, appKeys],
    [hudTool, modalityKeys, colorKeys, appKeys],
  );

  // `useHud` and `createLoupe` both read the canvas handle in a mount effect
  // and neither retries, so the loupe chrome can only mount once the handle
  // exists — which is a render later than this component's first, because
  // `<SceneCanvas>` waits on the host's measured size.
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const attachCanvas = useCallback((api: SceneCanvasApi | null) => {
    canvasRef.current = api;
    setCanvasReady(api !== null);
  }, []);

  const sliceTool = useSliceTool();

  // ── In-place text editing ─────────────────────────────────────────────────
  // The contenteditable overlay lives inside `.wd-canvas-host` (the workspace),
  // which is the positioning context it needs. It tracks pan/zoom through the
  // canvas mounted inside that host, so no view is passed.
  //
  // `hostRef.current` is null on the first render and populated by the time
  // the ResizeObserver's first sample re-renders (which is also when the
  // canvas mounts), so the overlay always has a container before an edit can
  // start.
  const textEdit = useSceneTextEdit(scene, hostRef.current, {
    // Clicking into the character bar must not end the edit it is editing.
    // The bar's dropdowns render in a portal under <body>, so they are not in
    // the bar's subtree and `closest` alone misses them — picking a font
    // ended the session, and the style patch then landed on nothing. Kit
    // overlays carry `data-weasel-overlay` for exactly this question.
    isEditorChrome: (el) =>
      el.closest(`.${TEXT_CHROME_CLASS}`) !== null
      || el.closest('[data-weasel-overlay]') !== null,
    // Escape out of a text edit keeps the text, as in every comparable
    // editor; losing a paragraph to a stray key is the worse failure.
    escape: 'commit',
  });

  // Keep the mode and the edit session in lockstep. The session can end
  // several ways — click-away commit, Escape, the node going away — and only
  // some of them run through the machine. Without this the breadcrumb kept
  // claiming `text-edit` after the editor was gone, which is the same
  // mode-vs-session split that left double-click with no editor at all.
  //
  // Keyed on the session *ending* (a non-null id going null), not on the
  // steady state "mode on, no session": the machine and `startEdit` are
  // driven by the same double-click but publish through different
  // subscriptions, so there is a render in between where the mode is live and
  // the session isn't. Reading that as "finished" exits the mode the instant
  // it's entered.
  const prevEditingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevEditingIdRef.current;
    prevEditingIdRef.current = textEdit.editingId;
    if (prev == null || textEdit.editingId != null) return;
    if (modeId === 'text-edit') modality.machine.exitMode();

    // An edit that ends with no text leaves a node that paints nothing and
    // still picks: a full-size invisible rectangle over the canvas, which is
    // most of why text picking felt haunted. Every editor discards an empty
    // text box on commit; so do we, and as a history entry so it's undoable.
    const nid = asNodeId(prev);
    const node = scene.get(nid);
    if (node && node.kind === 'leaf') {
      const data = node.data as WeaselDrawData;
      const isTextNode = data.text !== undefined;
      const hasRuns = Array.isArray(data.runs) && data.runs.length > 0;
      if (isTextNode && data.text === '' && !hasRuns) {
        scene.batch('Discard empty text', () => { scene.remove(nid); });
      }
    }
  }, [modeId, textEdit.editingId, modality.machine, scene]);

  // ...and the same seam from the other side: the mode can end while the
  // editor is still mounted (the breadcrumb's exit), which would leave it
  // over the canvas swallowing keystrokes. Commit it, as Escape does.
  const prevModeIdRef = useRef<string>(modeId);
  useEffect(() => {
    const prev = prevModeIdRef.current;
    prevModeIdRef.current = modeId;
    if (prev === 'text-edit' && modeId !== 'text-edit' && textEdit.editingId != null) {
      textEdit.commit();
    }
  }, [modeId, textEdit]);

  // What the options bar displays. The node's own style resolved first, the
  // range (or the run the caret sits in) over it, and last what is armed for
  // the next keystroke — which is what the user will see themselves type.
  const editingNode = textEdit.editingId != null
    ? scene.get(asNodeId(textEdit.editingId))
    : undefined;
  const barStyle: RangeStyle = effectiveRangeStyle(
    patchRangeStyle(textEdit.rangeStyle ?? {}, textEdit.pendingStyle),
    textEdit.nodeStyle ?? editingNode?.data.style,
    { fill: editingNode?.data.fill, stroke: editingNode?.data.stroke },
  );

  const onCharacterPatch = textEdit.applyStyleToSelection;

  // The overlay draws the node being edited, so the scene layer must not draw
  // it too — otherwise every keystroke shows against the pre-edit glyphs.
  // Composed over the modality scoping dim rather than replacing it: both are
  // per-node alpha, and an isolation-dimmed node can also be the one editing.
  const scopingAlphaFor = modality.scopingDim.alphaFor;
  const editingId = textEdit.editingId;
  const alphaFor = useCallback(
    (id: string) => (id === editingId ? 0 : scopingAlphaFor(id)),
    [editingId, scopingAlphaFor],
  );

  const { tool: opacityScrubTool, percent: opacityScrubPercent } = useOpacityScrub({
    scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
    selection,
  });

  // The mode tint covers the workspace around the page, not the page itself.
  // Bolder than the modes' own 0.12 so it reads through the stripes.
  const workspaceTint = useMemo(() => workspaceTintLayer({
    registry: modality.machine.registry,
    page: () => ({ x: 0, y: 0, width: paper.width, height: paper.height }),
    intensity: 0.4,
  }), [modality.machine, paper.width, paper.height]);

  const gridLayer = useMemo(() => createGridLayer({
    spacing: GRID_SPACING,
    bounds: () => ({ x: 0, y: 0, width: paper.width, height: paper.height }),
    accentEvery: 5,
    style: {
      line:   { paint: { fill: 'solid', color: contrastLineColor(backgroundColor, 0.06) }, width: 1 },
      accent: { paint: { fill: 'solid', color: contrastLineColor(backgroundColor, 0.14) }, width: 1 },
    },
  }), [paper.width, paper.height, backgroundColor]);

  const redrawOnScoping = useMemo(() => [modality.scopingDim], [modality.scopingDim]);

  return (
    <ActiveToolContextProvider>
    <div className="wd-app">
      <Toolbar
        scene={scene}
        selection={selection}
        paperSize={paperSize}
        setPaperSize={setPaperSize}
        filename={filename}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        onClearJournalCache={() => modality.machine.clearJournalCache()}
      />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      {/* Permanently reserved, never mounted on demand: the canvas is sized
          to the workspace, so appearing mid-edit would resize it under the
          caret. Empty until a text edit is in progress. */}
      <CharacterOptions
        className={TEXT_CHROME_CLASS}
        style={textEdit.editingId != null ? barStyle : undefined}
        onPatch={onCharacterPatch}
      >
        {canvasReady && (
          <LoupeControls canvasRef={canvasRef} source={loupeSource} />
        )}
      </CharacterOptions>
      <div className="wd-body">
        <Sidebar side="left" className="wd-sidebar left" ariaLabel="Tools">
          {tools && (
            <ToolPalette
              tools={tools}
              orientation="vertical"
              lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
              modeRegistry={modality.machine.registry}
            />
          )}
          <ActiveSwatches />
        </Sidebar>
        {/* Two things have to happen on a double-click into text, and they
            come from different places: `onDoubleClick` on SceneCanvas drives
            the modality machine into `text-edit` (breadcrumb, scoping dim),
            while the kit's own handler starts the edit *session* that mounts
            the contenteditable overlay and seeds the caret at the clicked
            glyph. Binding only the first flipped the mode with no editor
            under it — the node looked selected and refused to take a
            keystroke. */}
        <div
          className="wd-canvas-host"
          ref={hostRef}
          onDoubleClick={textEdit.onDoubleClick}
          data-mode={modeId}
        >
          <OpacityHud percent={opacityScrubPercent} />
          <ModeBreadcrumb
            mode={modality.machine.registry.byId(modeId)}
            targetLabel={targetLabel}
            onExit={() => modality.machine.exitMode()}
            onCommit={() => modality.machine.commitMode()}
            onCancel={() => modality.machine.cancelMode()}
          />
          {hostDims.width > 0 && hostDims.height > 0 && (
          <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> features={['draw']}
            claimKeys
            ref={attachCanvas}
            ambient={ambient}
            width={hostDims.width}
            height={hostDims.height}
            view={view}
            onViewChange={setView}
            scene={scene}
            poseComposition={DRAW_POSE_COMPOSITION}
            selection={selection}
            defaultTools={BUILTIN_TOOL_IDS}
            tools={{ slice: sliceTool, opacityScrub: opacityScrubTool }}
            ingestion={DRAW_INGESTION}
            // Pick on the drawn shape, not the bounding box. In a drawing app
            // the pose rect is an implementation detail: clicking the blank
            // right half of a text box, or the notch of a star, should reach
            // whatever is behind it — which is what every other editor does.
            geometry={{ picking: 'shape' }}
            viewport={{ pinchZoom: true, recenter }}
            cursorCoordsHud
            pickHud
            modalityHud
            onToolsCreated={setTools}
            selectTool={snapToGrid ? { snap: gridSnapStrategy<WeaselDrawPose>(GRID_SPACING) } : undefined}
            toolOptions={snapToGrid ? {
              snapPoint: (p) => ({
                x: Math.round(p.x / GRID_SPACING) * GRID_SPACING,
                y: Math.round(p.y / GRID_SPACING) * GRID_SPACING,
              }),
            } : undefined}
            layers={{
              paper: { layer: paperLayer, before: 'grid' },
              ...(gridVisible ? { grid: { layer: gridLayer } } : {}),
              modeTint: { layer: workspaceTint, after: 'grid' },
            }}
            decorationLayer={modality.decorationLayer}
            alphaFor={alphaFor}
            redrawOn={redrawOnScoping}
            isPointerInteractive={modality.scopingDim.isPointerInteractive}
            onDoubleClick={onDoubleClick}
            modes={modality.machine.registry}
            geometryProjection={{
              transform: (node, m) => {
                const data = node.data as WeaselDrawData;
                if (!data.path) return null; // text / no geometry — kit leaves data alone
                return { ...data, path: transformPath(data.path, m) };
              },
            }}
          >
            <BooleansAdapterPublisher scene={scene} selection={selection} />
            <CreateOutlinesAdapterPublisher scene={scene} selection={selection} />
            <TextEditDepPublisher edit={textEdit} />
          </SceneCanvas>
          )}
          <SceneGradientHandles
            scene={scene}
            containerRef={hostRef}
            nodeId={soleSelectedId}
            slot={colors.focused}
            view={view}
          />
        </div>
        <ResizeHandle
          value={rightWidth}
          min={RIGHT_SIDEBAR_MIN}
          max={RIGHT_SIDEBAR_MAX}
          invert
          onInput={setDragWidth}
          onChange={commitRightWidth}
          ariaLabel="Resize properties sidebar"
        />
        <Sidebar
          side="right"
          className="wd-sidebar right"
          ariaLabel="Properties"
          // Width lives in a custom property so app.css keeps ownership of the
          // clamp; only the number crosses the boundary.
          style={{ '--wd-right-width': `${rightWidth}px` } as CSSProperties}
        >
          <RightSidebar
            scene={scene}
            selection={selection}
            filename={filename}
            setFilename={setFilename}
            backgroundColor={backgroundColor}
            setBackgroundColor={setBackgroundColor}
            paperSize={paperSize}
            setPaperSize={setPaperSize}
            docSelected={docSelected}
            setDocSelected={setDocSelected}
          />
        </Sidebar>
      </div>
      <EditorStatusBar scene={scene} selection={selection} view={view} machine={modality.machine} />
    </div>
    </ActiveToolContextProvider>
  );
}

export default App;
