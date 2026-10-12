/**
 * WeaselDraw's editor: one `<SceneCanvas features={['draw']}>` with every built-in tool over a
 * `useScene` document, saved to local storage 300 ms after each change.
 */
import {
  ActiveToolContextProvider,
  asNodeId,
  buildSceneViewCommands,
  BUILTIN_TOOL_IDS,
  DEFAULT_STROKE_COLOR,
  defaultCommitAdapter,
  defaultDrawOne,
  fitViewToBounds,
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
import { useHudContribution } from '@weasel-js/hud/react';
import {
  CharacterOptions,
  CommandPalette,
  createRecentColorsStore,
  isCharacterChrome,
  RecentColorsProvider,
  ResizeHandle,
  SceneGradientHandles,
  Sidebar,
  ToastRegion,
  ToolPalette
} from '@weasel-js/ui';
import {
  type CSSProperties,
  type ReactElement,
  useCallback, useEffect, useMemo, useRef, useState
} from 'react';

import type { SceneCanvasHit } from '@weasel-js/core';
import { useSliceTool } from '@weasel-js/core';
import { unpackSvgFiles } from '@weasel-js/svg';
import { type ActivePaint, ActiveSwatches } from './ActiveSwatches';
import type { PaperSizeKey } from './CommandBar';
import { LoupeControls } from './LoupeControls';
import { PreferencesModal } from './PreferencesModal';
import { type AppCommands, appCommandsContribution } from './appCommands';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { loadDoc, PAPER_PRESETS, saveDoc } from './docPersistence';
import { reportSessionSave } from './fileNotices';
import { showFirstRunNotice } from './firstRunNotice';
import { disableMachineFontOutlines, enableMachineFontOutlines } from './fonts';
import { dispatchDoubleClickEntry, modalityShortcuts, modePathEdit } from './modality';
import { ModeBreadcrumb } from './modality/chrome/ModeBreadcrumb';
import { useModality } from './modality/useModality';
import { OpacityHud } from './opacityScrub/OpacityHud';
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { clipboardJsonReviver, serializeReplacer } from './persistence';
import { PREFS, usePref } from './prefs';
import { useRecording } from './recording/useRecording';
import { hasCompoundPath, releaseCompoundPaths } from './releaseCompound';
import { writeSession } from './sessionStore';
import { colorContribution, useColorContext } from './tools/colorContext';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { TextEditDepPublisher } from './TextEditDepPublisher';
import { toolEnumSources } from './registry/toolEnumSource';
import { useGrid } from './useGrid';
import { useLastTool } from './useLastTool';

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
import { type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { activeInsertPaint } from './insertPaint';
import { reportPasteOmissions } from './pasteOmissions';
import { HISTORY_KEY, loadHistory, loadInitial, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

const RECENT_COLORS_KEY = 'weaseldraw:recent-colors';

// OS-dropped and pasted SVG files unpack into real scene nodes rather than one embedded-image
// node. `clipboard.reviver` revives typed-array node data carried by weasel-JSON clipboard
// payloads. Module const: SceneCanvas keys its dep wiring off the prop identity.
const DRAW_INGESTION = {
  svg: { unpack: unpackSvgFiles },
  clipboard: { reviver: clipboardJsonReviver, onOmitted: reportPasteOmissions },
};
/** Seed fill for a fresh document: a blue rather than the kit's white `DEFAULT_FILL_COLOR`,
 *  so a new shape lands visible against the white page. */
const INITIAL_FILL_COLOR = '#7ab8d4ff';
export function App(): ReactElement {
  const [initialScene] = useState(loadInitial);
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    initial: initialScene,
  });
  const selection = useSelection({ mode: 'multi', scene });

  const modality = useModality(scene);

  // Restored external-op history entries replay against this adapter after a reload. It has to be
  // `defaultCommitAdapter`: the canvas adapter lacks `setData` and `setLayer`, so a restored
  // nudge's geometry-projection setData op would fail against it.
  useEffect(() => {
    const a = defaultCommitAdapter(scene);
    scene.setHistoryAdapter(() => a);
    return () => scene.setHistoryAdapter(null);
  }, [scene]);

  // Restore the persisted undo stacks once on mount. `restoredRef` then unblocks the persist
  // effect so it can't clobber the saved history with the empty initial stack first.
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

  // Persist on every commit, debounced 300ms to coalesce drag bursts. Scene and history go under
  // separate keys so a shape migration of one never disturbs the other. A page going away
  // mid-debounce writes at once.
  const pendingSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const save = (): void => {
      pendingSaveRef.current = null;
      if (!restoredRef.current) return;
      try {
        reportSessionSave(writeSession(
          localStorage,
          [LS_KEY, JSON.stringify(scene.toJSON(), serializeReplacer)],
          [
            [HISTORY_KEY, JSON.stringify(modality.history.serialize(), serializeReplacer)],
            [SCENE_HISTORY_KEY, JSON.stringify(scene.serializeHistory(), serializeReplacer)],
          ],
        ));
      } catch {
        // No store at all, or a scene that will not serialize.
        reportSessionSave(false);
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
  useLastTool(tools);
  const prefSources = useMemo(() => toolEnumSources(tools), [tools]);
  const actionsReg = useActionsRegistry();
  const colors = useColorContext();
  // On-canvas gradient handles edit one node's one paint; which paint is the
  // side the swatches have focus on.
  const selectedIds = selection.get();
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const [initialDoc] = useState(loadDoc);
  const [paperSize, setPaperSize] = useState<PaperSizeKey>(initialDoc.paperSize);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => showFirstRunNotice(), []);

  // `dragWidth` shadows the pref for the duration of a drag so a pointer-rate stream of samples
  // doesn't schedule a prefs write per frame.
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
      // A refusal is the user's answer, so put the switch back to match it. Anything else — no
      // API in this browser, a transient failure — leaves the preference alone.
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
  if (selection.current.length > 0 && docSelected) setDocSelected(false);

  // Persist the document with the same 300ms debounce as the scene.
  useEffect(() => {
    const id = setTimeout(() => saveDoc({ filename, backgroundColor, paperSize }), 300);
    return () => clearTimeout(id);
  }, [filename, backgroundColor, paperSize]);

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
    selection: (): readonly string[] => selection.get(),
  });
  const modalityKeys = useMemo(() => modalityShortcuts(modality.machine, {
    pathToEdit: () => pathEditEntry.current.pathToEdit(),
    selection: () => pathEditEntry.current.selection(),
  }), [modality.machine, pathEditEntry]);

  // The path being anchor-edited is the path-edit mode's target, read from the machine.
  const pathEdit = useMemo(() => modePathEdit(
    modality.machine,
    (id) => (scene.get(asNodeId(id))?.data as WeaselDrawData | undefined)?.path?.kind === 'polygon',
  ), [modality.machine, scene]);

  const onDoubleClick = useCallback((hit: SceneCanvasHit | null) => {
    dispatchDoubleClickEntry(hit, modality.machine);
  }, [modality.machine]);

  const paper = PAPER_PRESETS[paperSize];

  // The canvas fills the whole `.wd-canvas-host` workspace; the document page is drawn as a
  // world-space layer.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hostDims = useCanvasSize(hostRef);

  // Refit-to-page runs on the first host-dims sample and on every paperSize change, deliberately
  // not on later host resizes — that would hijack the user's pan/zoom.
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const lastFitPaperRef = useRef<PaperSizeKey | null>(null);
  // Wired into `viewport.recenter` so Cmd-0 refits the page. Reads through refs so the callback
  // identity stays constant for SceneCanvas.
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

  // The document page: a world-space rect filled with the doc's backgroundColor, so the workspace
  // stripes show everywhere outside it.
  const paperLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'paper',
    label: 'Paper',
    // World-space commands; drawLayers wraps in viewToMat3 automatically.
    draw: () => [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: paper.width, height: paper.height },
      fill: { paint: { kind: 'solid', color: backgroundColor } },
    }],
  }), [paper.width, paper.height, backgroundColor]);

  // What the loupe magnifies: the page and the scene on top of it. The scene half projects inside
  // `buildSceneViewCommands`, which is what `space: 'screen'` says about it.
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
  const [pathFillRule] = usePref('drawing.pathFillRule');
  const fillRuleRef = useLatest(pathFillRule);
  const insertPaint = useMemo(
    () => activeInsertPaint(() => colorsRef.current, () => (fillRuleRef.current === 'evenodd' ? 'evenodd' : 'nonzero')),
    [colorsRef, fillRuleRef],
  );
  const grid = useGrid(paper, backgroundColor);
  const appCommands: AppCommands = {
    ...grid.commands,
    canReleaseCompound: hasCompoundPath(scene, selection.current),
    releaseCompound: () => selection.set(releaseCompoundPaths(scene, selection.current)),
    openPrefs: () => setPrefsOpen(true),
    openPalette: () => setPaletteOpen(true),
  };
  const appCommandsRef = useLatest(appCommands);
  const appKeys = useMemo(() => appCommandsContribution(() => appCommandsRef.current), [appCommandsRef]);
  const recordingKeys = useRecording({ scene, view: () => view, setView });
  const ambient = useMemo(
    () => [hudTool, modalityKeys, colorKeys, appKeys, recordingKeys],
    [hudTool, modalityKeys, colorKeys, appKeys, recordingKeys],
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

  // The contenteditable overlay lives inside `.wd-canvas-host`, the positioning context it needs.
  // `hostRef.current` is null on the first render and populated by the time the canvas mounts, so
  // the overlay always has a container before an edit can start.
  const textEdit = useSceneTextEdit(scene, hostRef.current, {
    isEditorChrome: isCharacterChrome,
    // Escape out of a text edit keeps the text, as in every comparable
    // editor; losing a paragraph to a stray key is the worse failure.
    escape: 'commit',
  });

  // Keep the mode and the edit session in lockstep: the session can end several ways — click-away
  // commit, Escape, the node going away — and only some of them run through the machine.
  //
  // Keyed on the session *ending* (a non-null id going null), not on "mode on, no session": the
  // machine and `startEdit` publish through different subscriptions, so there is a render in
  // between where the mode is live and the session isn't.
  const prevEditingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevEditingIdRef.current;
    prevEditingIdRef.current = textEdit.editingId;
    if (prev == null || textEdit.editingId != null) return;
    if (modeId === 'text-edit') modality.machine.exitMode();

    // An edit that ends with no text leaves a node that paints nothing and still picks, so
    // discard it — as a history entry, so it's undoable.
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

  // The mode can also end while the editor is still mounted (the breadcrumb's exit), which would
  // leave it over the canvas swallowing keystrokes. Commit it, as Escape does.
  const prevModeIdRef = useRef<string>(modeId);
  useEffect(() => {
    const prev = prevModeIdRef.current;
    prevModeIdRef.current = modeId;
    if (prev === 'text-edit' && modeId !== 'text-edit' && textEdit.editingId != null) {
      textEdit.commit();
    }
  }, [modeId, textEdit]);

  // The overlay draws the node being edited, so the scene layer must not draw it too. Composed
  // over the modality scoping dim: an isolation-dimmed node can also be the one editing.
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
        setFilename={setFilename}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        onClearJournalCache={() => modality.machine.clearJournalCache()}
      />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} registryEnumSources={prefSources} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* Permanently reserved, never mounted on demand: the canvas is sized
          to the workspace, so appearing mid-edit would resize it under the
          caret. Empty until a text edit is in progress. */}
      <CharacterOptions style={textEdit.effectiveStyle} onPatch={textEdit.applyStyleToSelection}>
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
        {/* A double-click into text does two things from different places: `onDoubleClick` on
            SceneCanvas drives the modality machine into `text-edit`, while the kit's handler here
            starts the edit session that mounts the contenteditable overlay. */}
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
            selection={selection}
            defaultTools={BUILTIN_TOOL_IDS}
            tools={{ slice: sliceTool, opacityScrub: opacityScrubTool }}
            ingestion={DRAW_INGESTION}
            insertPaint={insertPaint}
            // Pick on the drawn shape, not the bounding box: clicking the blank right half of a
            // text box, or the notch of a star, should reach whatever is behind it.
            geometry={{ picking: 'shape' }}
            viewport={{ pinchZoom: true, recenter }}
            cursorCoordsHud
            pickHud
            modalityHud
            onToolsCreated={setTools}
            selectTool={grid.snap ? { snap: grid.snap } : undefined}
            toolOptions={grid.snapPoint ? { snapPoint: grid.snapPoint } : undefined}
            layers={{
              paper: { layer: paperLayer, before: 'grid' },
              ...(grid.layer ? { grid: { layer: grid.layer } } : {}),
              modeTint: { layer: workspaceTint, after: 'grid' },
            }}
            decorationLayer={modality.decorationLayer}
            alphaFor={alphaFor}
            redrawOn={redrawOnScoping}
            isPointerInteractive={modality.scopingDim.isPointerInteractive}
            onDoubleClick={onDoubleClick}
            modes={modality.machine.registry}
            pathEdit={pathEdit}
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
          {/* In the workspace, not the viewport: a fixed region sits outside the theme and over the status bar. */}
          {hostRef.current && <ToastRegion portalContainer={hostRef.current} />}
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
