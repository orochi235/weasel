import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  CANVAS_CONTEXT_ATTRIBUTES,
  DEFAULT_ALLOWED_CAPABILITIES,
  WeaselProvider,
  buildRuleCtx,
  createDispatcher,
  createPoseFeed,
  createSnapOutcomeStore,
  useAction,
  useActionsRegistry,
  useActiveToolContext,
  useDepSource,
  useGestureDispatcher,
  useLatest,
  useSelectTool,
  selectionMoveContribution,
  useStandardActions,
  type Dispatcher,
  type NodeId,
  type Tool,
  type WorldPoint,
} from '@weasel-js/core';
import { useKitSettings } from '@weasel-js/react';
import { f } from '../../src/config';
import { defineInstrument } from '../../src/instrument/defineInstrument';
import type { RenderContext } from '../../src/instrument/types';
import { useSurface, useSurfaceCanvas, useSurfaceTile, useTileId } from '../../src/surface';
import { toDeviceRect } from '../../src/surface/deviceRect';
import { useOrbitView } from '../../src/trial/useOrbitView';
import type { Vec3 } from '@weasel-js/geom/3d';
import {
  alignPlaneSource,
  boxSnapSource,
  collectOverlayBoxes,
  createAreaSelect,
  createCamera,
  createNodeAtPoint,
  createPoseDescriptor,
  createSnap,
  groundGridSource,
  projectSnapMarks,
  screenBoxOf,
  useOrbitTool,
  orbitAction,
  panAction,
  type Camera3d,
  type ChromeBox,
  type Viewport3d,
} from '@weasel-js/kernel3d';
import { applyFeedDelta, solidsToDraw, type SolidRecord } from './draws3d';
import { createRenderer3d, type Renderer3d } from './renderer3d';
import {
  aabbOfSolid, createSolidScene, type Pose3, type SolidNode, type SolidScene,
} from './scene3d';
import { useBoxTool } from './tools3d';
import { useGroupEntry3d, type GroupEntry3d } from './groupEntry3d';
import { useBoxInsert } from './insert3d';

interface SolidState {
  /** Kept only so labkit has something to persist; the scene itself is a ref. */
  solidCount: number;
}

interface SolidConfig {
  showChrome: boolean;
}

const TILE = 'viewport';
const HOME = createCamera({ distance: 14, pitch: 0.45, yaw: 0.6, target: { x: 0, y: 0.5, z: 0 } });

/**
 * The lab's viewport. Everything interesting is in the wiring: core's
 * dispatcher, core's actions, core's select tool, and a set of deps that read
 * the same two numbers the 2D kit reads and turn them into rays.
 */
function Viewport({ config }: { config: SolidConfig }): ReactNode {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const tileId = useTileId(TILE);
  const attachTile = useSurfaceTile(TILE);
  const surface = useSurface();
  // Under the trials: the viewport is opaque and fills its pane, so on the
  // over-buffer it would bury anything the pane's own DOM drew.
  const glCanvas = useSurfaceCanvas('under');
  const rendererRef = useRef<Renderer3d | null>(null);

  const sceneRef = useRef<SolidScene | null>(null);
  if (!sceneRef.current) sceneRef.current = createSolidScene();
  const scene = sceneRef.current;

  // The dispatcher is normally `<SceneCanvas>`'s to own and share with its
  // preview-ghost layer. Mounting the hook directly means creating it here so
  // the painter can read the same in-flight handles.
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) dispatcherRef.current = createDispatcher();
  const dispatcher = dispatcherRef.current;

  // The trial owns the camera: it persists, Clone copies it and Reset puts it
  // back. The wheel reaches it through the trial; the orbit tool below turns
  // and pans it through this viewport's own `camera3d` dep.
  const orbitView = useOrbitView();
  const camera = orbitView.camera ?? HOME;
  const setCameraRef = useLatest(orbitView.setCamera);
  const [selection, setSelection] = useState<readonly NodeId[]>([]);

  const cameraRef = useLatest(camera);
  const selectionRef = useLatest(selection);
  const sizeRef = useRef({ width: 1, height: 1 });
  const originRef = useRef({ x: 0, y: 0 });
  const showChromeRef = useLatest(config.showChrome);
  /** One draw record per node, kept across frames and patched from the feed. */
  const drawsRef = useRef(new Map<NodeId, SolidRecord>());
  /** Read by the painter for the boxes it outlines; set once the deps exist below. */
  const groupEntryRef = useRef<GroupEntry3d | null>(null);

  const viewportSource = useCallback(
    (): Viewport3d => ({
      camera: cameraRef.current,
      ...sizeRef.current,
      originX: originRef.current.x,
      originY: originRef.current.y,
    }),
    [cameraRef],
  );

  const repaint = useCallback(() => surface.invalidate(tileId), [surface, tileId]);
  useEffect(repaint, [repaint, camera, selection]);

  // Straight from the scene to the scheduler. A React render to ask for a paint
  // would be a render per scene change, and `surface.invalidate` already
  // collapses a burst of these to one frame.
  const feed = useMemo(() => createPoseFeed(scene), [scene]);
  useEffect(() => feed.subscribe(repaint), [feed, repaint]);

  // The toolbar readout is DOM, so it does need a render when the scene moves —
  // which is not the same thing as rendering to schedule a paint, above.
  useSyncExternalStore(scene.subscribe, scene.getVersion);

  // Overlay chrome — the marquee sweep, the uncommitted box — is read off the
  // in-flight handles, which mutate without a React render. Ghost poses arrive
  // through the feed instead; this is what drives a frame for the rest.
  useEffect(() => dispatcher.subscribe(repaint), [dispatcher, repaint]);

  // What the snap in flight met, drawn beside the chrome.
  const snapMarks = useMemo(() => createSnapOutcomeStore<Vec3>(), []);
  useEffect(() => snapMarks.subscribe(repaint), [snapMarks, repaint]);

  // Everything the kernel needs told about this world: the scene, where the
  // camera is, and — because a sphere's box does not widen when it turns — how
  // wide a solid actually is.
  const world = useMemo(
    () => ({
      scene,
      viewport: viewportSource,
      // A container only groups its solids: it occupies nothing of its own.
      bounds: (node: SolidNode) => (node.kind === 'group' ? null : aabbOfSolid(node.pose, node.data.kind)),
    }),
    [scene, viewportSource],
  );

  // ── Painting ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!glCanvas) return;
    const gl = glCanvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES);
    if (!gl) return;

    const renderer = createRenderer3d(gl);
    rendererRef.current = renderer;

    const unregisterClear = surface.registerClear(tileId, (size, dpr) => {
      renderer.clearAll(Math.round(size.width * dpr), Math.round(size.height * dpr));
    });

    const unregister = surface.registerPainter(tileId, (rect, frame) => {
      const draws = drawsRef.current;
      applyFeedDelta(draws, feed.read());

      sizeRef.current = { width: rect.w, height: rect.h };
      const paneRect = paneRef.current?.getBoundingClientRect();
      if (paneRect) originRef.current = { x: paneRect.left, y: paneRect.top };
      const css = toDeviceRect(rect, frame.size.height, frame.dpr);
      const device = {
        x: Math.round(css.x * frame.dpr),
        y: Math.round(css.y * frame.dpr),
        w: Math.round(css.w * frame.dpr),
        h: Math.round(css.h * frame.dpr),
      };
      const solids = solidsToDraw(scene, draws, new Set(selectionRef.current));

      // The chrome is drawn here rather than in the DOM because the shared
      // buffer paints above the instrument, so anything inside the pane would
      // be hidden behind this tile.
      const viewport = {
        camera: cameraRef.current,
        width: rect.w,
        height: rect.h,
        originX: originRef.current.x,
        originY: originRef.current.y,
      };
      // Boxes come back in the client space the deps work in; the renderer
      // draws inside the tile, so they land back at the pane's own origin.
      // A container's box spans its solids. The entered one is outlined as a
      // gesture is, so it reads apart from the selection inside it.
      const boxOf = (id: NodeId) => groupEntryRef.current?.boxOf(id) ?? screenBoxOf(world, id, viewport);
      const entered = groupEntryRef.current?.entered.get() ?? null;
      const outlined: Array<[NodeId, ChromeBox['tint']]> = showChromeRef.current
        ? selectionRef.current.map((id): [NodeId, ChromeBox['tint']] => [id, 'selection'])
        : [];
      if (entered !== null) outlined.push([entered, 'gesture']);
      const chrome: ChromeBox[] = outlined.flatMap(([id, tint]) => {
        const box = boxOf(id);
        return box ? [{ ...box, x: box.x - originRef.current.x, y: box.y - originRef.current.y, tint }] : [];
      });

      // A marquee sweep and a box-drag, read off the same handles the ghosts
      // come from. `resolveOverlays` hands back world geometry, which this
      // lab's identity `clientToWorld` leaves as the client rect.
      chrome.push(...collectOverlayBoxes(dispatcher.getInFlightHandles(), originRef.current));

      // Projected without the pane's origin, so they land in the tile as drawn.
      const snap = projectSnapMarks(snapMarks.get(), { camera: cameraRef.current, width: rect.w, height: rect.h });

      renderer.draw(solids, cameraRef.current, device, chrome, {
        width: rect.w,
        height: rect.h,
      }, snap);
    });

    return () => {
      unregister();
      unregisterClear();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [glCanvas, surface, tileId, scene, dispatcher, feed, world, selectionRef, cameraRef, showChromeRef, snapMarks]);

  // ── Deps ───────────────────────────────────────────────────────────────
  const selectionApi = useMemo(
    () => ({
      get current() {
        return selectionRef.current;
      },
      get: () => [...selectionRef.current],
      set: (ids: NodeId[]) => setSelection(ids),
      add: (id: NodeId) => setSelection((prev) => (prev.includes(id) ? prev : [...prev, id])),
      remove: (id: NodeId) => setSelection((prev) => prev.filter((x) => x !== id)),
      clear: () => setSelection([]),
      toggle: (id: NodeId) =>
        setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      contains: (id: NodeId) => selectionRef.current.includes(id),
      applyClick: (id: NodeId, modifiers: { shift: boolean; meta: boolean; ctrl: boolean }) =>
        setSelection((prev) => {
          if (!modifiers.shift) return [id];
          return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        }),
      adapterMethods: {
        getSelection: () => [...selectionRef.current],
        setSelection: (ids: NodeId[]) => setSelection(ids),
      },
    }),
    [selectionRef],
  );

  // Every pick below goes through the entered group's scope: outside it,
  // nothing takes a hit and a press lands on empty canvas.
  const worldPick = useMemo(() => createNodeAtPoint(world), [world]);
  const groupEntry = useGroupEntry3d(world, viewportSource, worldPick, repaint);
  useEffect(() => {
    groupEntryRef.current = groupEntry;
  }, [groupEntry]);
  const nodeAtPoint = groupEntry.pick;
  const { reachable } = groupEntry;
  const areaSelect = useMemo(() => {
    const all = createAreaSelect(world, selectionApi);
    return { ...all, hitTestArea: (rect: Parameters<typeof all.hitTestArea>[0]) => all.hitTestArea(rect).filter(reachable) };
  }, [world, selectionApi, reachable]);
  const insert = useBoxInsert(scene, viewportSource);
  const poseDescriptor = useMemo(() => createPoseDescriptor(world), [world]);
  const kitSettings = useKitSettings();
  const snap = useMemo(
    () => createSnap(world, {
      sources: [boxSnapSource(world), alignPlaneSource(world), groundGridSource({ step: 1 })],
      store: snapMarks,
      kitSettings,
    }),
    [world, snapMarks, kitSettings],
  );

  const camera3d = useMemo(
    () => ({
      get: () => cameraRef.current,
      set: (next: Camera3d) => setCameraRef.current(next),
      size: () => sizeRef.current,
    }),
    [cameraRef, setCameraRef],
  );

  // `scene.history` is the same handle `<SceneCanvas>` registers, so Cmd+Z
  // runs the kit's own undo action here rather than a lab-local button.
  useStandardActions({ selection: selectionApi, scene: scene as never, history: scene.history });
  useDepSource('camera3d', () => camera3d);
  useDepSource('nodeAtPoint', () => nodeAtPoint);
  useDepSource('areaSelect', () => areaSelect);
  useDepSource('insert', () => insert);
  useDepSource('snap', () => snap);
  useDepSource('poseDescriptor', () => poseDescriptor as never);
  useAction(orbitAction);
  useAction(panAction);

  // ── Tools ──────────────────────────────────────────────────────────────
  const pickEvery = useCallback(
    (world: WorldPoint): string[] => {
      const id = nodeAtPoint(world);
      return id ? [id] : [];
    },
    [nodeAtPoint],
  );
  const pickBest = useCallback(
    (world: WorldPoint): string | null => nodeAtPoint(world),
    [nodeAtPoint],
  );

  const selectAdapter = useMemo(
    () => ({
      getNode: (id: string) => scene.get(id as NodeId),
      getNodes: () => [...scene.renderOrderNodes()],
      getPose: (id: string) => scene.get(id as NodeId)!.pose,
      setPose: (id: string, pose: Pose3) => scene.setPose(id as NodeId, pose),
      getParent: (id: string) => scene.get(id as NodeId)?.parent ?? null,
      getChildren: (parentId: string | null): string[] =>
        (parentId === null ? [...scene.roots] : [...scene.childrenOf(parentId as NodeId)]),
      hitTestArea: (rect: { x: number; y: number; width: number; height: number }) =>
        areaSelect.hitTestArea(rect) as string[],
      getSelection: () => [...selectionRef.current] as string[],
      setSelection: (ids: string[]) => setSelection(ids as NodeId[]),
    }),
    [scene, areaSelect, selectionRef],
  );

  const select = useSelectTool(selectAdapter, { pickEvery, pickBest, poseDescriptor });
  const orbit = useOrbitTool();
  const box = useBoxTool();
  // The select tool only picks; dragging a solid to move it is the
  // selection's own ambient binding, live under every tool here.
  const selectionMove = useMemo(() => selectionMoveContribution() as Tool, []);
  const entriesById = useMemo(
    () =>
      new Map<string, Tool>([
        ['select', select as Tool],
        ['orbit', orbit as Tool],
        ['box', box as Tool],
        [selectionMove.id, selectionMove],
        [groupEntry.contribution.id, groupEntry.contribution],
      ]),
    [select, orbit, box, selectionMove, groupEntry.contribution],
  );

  const activeTool = useActiveToolContext();
  const actions = useActionsRegistry();

  // What actions read to know which tool is live. Not what gates `select.pick`:
  // an `eligible: { capability }` rule reads `RuleCtx.allowedCapabilities`,
  // which reaches the dispatcher only through `getRuleCtx` — unset here, so
  // every eligibility rule is skipped and the action fires regardless.
  useDepSource('activeTool', () => activeTool);

  // A tool's own actions ride on its definition, and `<SceneCanvas>` is what
  // normally registers them. Mounting tools directly means doing it here.
  useEffect(() => {
    if (!actions) return;
    const unregister = [...entriesById.values()].flatMap((tool) =>
      (tool.actions ?? []).map((action) => actions.register(action)),
    );
    return () => {
      for (const undo of unregister) undo?.();
    };
  }, [actions, entriesById]);

  // The select tool's bindings are keyed on what the press landed on, so the
  // dispatcher needs this as well as the pick dep. Both take a screen point.
  const classifyTarget = useCallback(
    (point: { x: number; y: number }) => {
      const id = nodeAtPoint(point);
      if (!id) return { body: 'empty' as const };
      return {
        body: (selectionRef.current.includes(id) ? 'selected-body' : 'unselected-body') as
          | 'selected-body'
          | 'unselected-body',
      };
    },
    [nodeAtPoint, selectionRef],
  );

  /**
   * Identity, and it has to be: `classifyTarget` is handed the client point
   * while an action's `ctx.world` is handed `clientToWorld` of it. Transform
   * here and the lab's deps, which subtract the pane origin themselves, would
   * subtract it twice on one of those two paths. One space from the event to
   * the ray.
   */
  const clientToWorld = useCallback((clientX: number, clientY: number) => ({
    x: clientX,
    y: clientY,
  }), []);

  /**
   * Eligibility, which a 3D host can supply now that a `RuleCtx` asks for a
   * zoom rather than a `View`. Left unset — as it was — the dispatcher skips
   * every rule and each action fires unconditionally, so the lab was not
   * exercising the gate it claims to share with `<SceneCanvas>`.
   *
   * No zoom: this viewport is a camera, and `zoomAtLeast` has no answer here.
   */
  const getRuleCtx = useCallback(() => buildRuleCtx({
    focused: true,
    selection: selectionRef.current,
    multiActive: selectionRef.current.length > 1,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: dispatcher.getActiveAction(),
    hover: null,
    mode: 'normal',
    allowedCapabilities: DEFAULT_ALLOWED_CAPABILITIES,
  }), [dispatcher, selectionRef]);

  useGestureDispatcher({
    canvasRef: paneRef,
    dispatcher,
    actions: actions!,
    entriesById,
    clientToWorld,
    classifyTarget,
    getRuleCtx,
    requestRedraw: repaint,
  });

  // The trial's camera anchors its dolly in this pane, under the toolbar,
  // where the renderer projects.
  const viewportRef = orbitView.viewportRef;
  const attachPane = useCallback(
    (el: HTMLDivElement | null) => {
      paneRef.current = el;
      attachTile(el);
      viewportRef(el);
    },
    [attachTile, viewportRef],
  );

  return (
    <div className="td-root">
      <div className="td-bar">
        {(['select', 'orbit', 'box'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={activeTool.active === id ? 'td-tool td-tool--on' : 'td-tool'}
            onClick={() => activeTool.setActive(id)}
          >
            {id}
          </button>
        ))}
        <span className="td-count">
          {scene.renderOrderNodes().length} solids · {selection.length} selected
        </span>
        <button type="button" className="td-tool" onClick={() => scene.history.undo()}>
          undo
        </button>
        <button type="button" className="td-tool" onClick={() => scene.history.redo()}>
          redo
        </button>
      </div>
      <div className="td-pane" ref={attachPane} />
    </div>
  );
}

export const SolidInstrument = defineInstrument<SolidState, SolidConfig>({
  name: 'Solids',
  initialState: () => ({ solidCount: 3 }),
  config: f.schema({ showChrome: f.boolean(true) }),
  // The viewport runs its own dispatcher for its tools, so a press belongs to
  // it, and two fingers with it: the trial's camera takes the wheel and the
  // trackpad's pinch.
  orbit: { initialView: HOME, gestures: { drag: false, home: false, pinch: 'trackpad' } },
  render: (ctx) => {
    const typed = ctx as RenderContext<SolidState, SolidConfig>;
    return (
      <WeaselProvider isolate>
        <Viewport config={typed.config} />
      </WeaselProvider>
    );
  },
});
