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
  WeaselProvider,
  createDispatcher,
  createPoseFeed,
  useAction,
  useActionsRegistry,
  useActiveToolContext,
  useDepSource,
  useGestureDispatcher,
  useSelectTool,
  useStandardActions,
  type Dispatcher,
  type NodeId,
  type Tool,
} from '@weasel-js/core';
import { f } from '../../src/config';
import { defineInstrument } from '../../src/instrument/defineInstrument';
import type { RenderContext } from '../../src/instrument/types';
import { useSurface, useSurfaceCanvas, useSurfaceTile, useTileId } from '../../src/surface';
import { toDeviceRect } from '../../src/surface/deviceRect';
import {
  collectOverlayBoxes,
  createAreaSelect,
  createCamera,
  createInsert,
  createNodeAtPoint,
  createPoseDescriptor,
  createSnap,
  pose3,
  screenBoxOf,
  useOrbitTool,
  dollyAction,
  orbitAction,
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

interface SolidState {
  /** Kept only so labkit has something to persist; the scene itself is a ref. */
  solidCount: number;
}

interface SolidConfig {
  showChrome: boolean;
}

const TILE = 'viewport';

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

  const [camera, setCamera] = useState<Camera3d>(() =>
    createCamera({ distance: 14, pitch: 0.45, yaw: 0.6, target: [0, 0.5, 0] }),
  );
  const [selection, setSelection] = useState<readonly NodeId[]>([]);

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sizeRef = useRef({ width: 1, height: 1 });
  const originRef = useRef({ x: 0, y: 0 });
  const showChromeRef = useRef(config.showChrome);
  showChromeRef.current = config.showChrome;
  /** One draw record per node, kept across frames and patched from the feed. */
  const drawsRef = useRef(new Map<NodeId, SolidRecord>());

  const viewportSource = useCallback(
    (): Viewport3d => ({
      camera: cameraRef.current,
      ...sizeRef.current,
      originX: originRef.current.x,
      originY: originRef.current.y,
    }),
    [],
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

  // Everything the kernel needs told about this world: the scene, where the
  // camera is, and — because a sphere's box does not widen when it turns — how
  // wide a solid actually is.
  const world = useMemo(
    () => ({
      scene,
      viewport: viewportSource,
      bounds: (node: SolidNode) => aabbOfSolid(node.pose, node.data.kind),
    }),
    [scene, viewportSource],
  );

  // ── Painting ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!glCanvas) return;
    const gl = glCanvas.getContext('webgl2', { preserveDrawingBuffer: true });
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
      const solids = solidsToDraw(draws, new Set(selectionRef.current));

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
      const chrome: ChromeBox[] = showChromeRef.current
        ? selectionRef.current
            .map((id) => screenBoxOf(world, id, viewport))
            .filter((box): box is ChromeBox => box !== null)
            .map((box) => ({
              ...box,
              x: box.x - originRef.current.x,
              y: box.y - originRef.current.y,
              tint: 'selection' as const,
            }))
        : [];

      // A marquee sweep and a box-drag, read off the same handles the ghosts
      // come from. `resolveOverlays` hands back world geometry, which this
      // lab's identity `clientToWorld` leaves as the client rect.
      chrome.push(...collectOverlayBoxes(dispatcher.getInFlightHandles(), originRef.current));

      renderer.draw(solids, cameraRef.current, device, chrome, {
        width: rect.w,
        height: rect.h,
      });
    });

    return () => {
      unregister();
      unregisterClear();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [glCanvas, surface, tileId, scene, dispatcher, feed, world]);

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
    [],
  );

  const nodeAtPoint = useMemo(() => createNodeAtPoint(world), [world]);
  const areaSelect = useMemo(
    () => createAreaSelect(world, selectionApi),
    [world, selectionApi],
  );
  const insert = useMemo(
    () =>
      createInsert({
        viewport: viewportSource,
        mint: ({ center, width, depth }) => {
          const height = (width + depth) / 2;
          return scene.add({
            kind: 'leaf',
            layer: 'solids',
            pose: pose3([center[0], height / 2, center[2]], [width, height, depth]),
            data: { kind: 'box', color: '#c49a3f' },
          });
        },
      }),
    [scene, viewportSource],
  );
  const poseDescriptor = useMemo(() => createPoseDescriptor(world), [world]);
  const snap = useMemo(() => createSnap(), []);

  const camera3d = useMemo(
    () => ({
      get: () => cameraRef.current,
      set: (next: Camera3d) => setCamera(next),
      size: () => sizeRef.current,
    }),
    [],
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
  useAction(dollyAction);

  // ── Tools ──────────────────────────────────────────────────────────────
  const pickEvery = useCallback(
    (worldX: number, worldY: number): string[] => {
      const id = nodeAtPoint({ x: worldX, y: worldY });
      return id ? [id] : [];
    },
    [nodeAtPoint],
  );
  const pickBest = useCallback(
    (worldX: number, worldY: number): string | null => nodeAtPoint({ x: worldX, y: worldY }),
    [nodeAtPoint],
  );

  const selectAdapter = useMemo(
    () => ({
      getNode: (id: string) => scene.get(id as NodeId),
      getNodes: () => [...scene.renderOrderNodes()],
      getPose: (id: string) => scene.get(id as NodeId)!.pose,
      setPose: (id: string, pose: Pose3) => scene.setPose(id as NodeId, pose),
      getParent: (id: string) => scene.get(id as NodeId)?.parent ?? null,
      hitTestArea: (rect: { x: number; y: number; width: number; height: number }) =>
        areaSelect.hitTestArea(rect) as string[],
      getSelection: () => [...selectionRef.current] as string[],
      setSelection: (ids: string[]) => setSelection(ids as NodeId[]),
    }),
    [scene, areaSelect],
  );

  const select = useSelectTool(selectAdapter, { pickEvery, pickBest, poseDescriptor });
  const orbit = useOrbitTool();
  const box = useBoxTool();
  const toolsById = useMemo(
    () =>
      new Map<string, Tool>([
        ['select', select as Tool],
        ['orbit', orbit as Tool],
        ['box', box as Tool],
      ]),
    [select, orbit, box],
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
    const unregister = [...toolsById.values()].flatMap((tool) =>
      (tool.actions ?? []).map((action) => actions.register(action)),
    );
    return () => {
      for (const undo of unregister) undo?.();
    };
  }, [actions, toolsById]);

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
    [nodeAtPoint],
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

  useGestureDispatcher({
    canvasRef: paneRef,
    dispatcher,
    actions: actions!,
    toolsById,
    clientToWorld,
    classifyTarget,
    requestRedraw: repaint,
  });

  const attachPane = useCallback(
    (el: HTMLDivElement | null) => {
      paneRef.current = el;
      attachTile(el);
    },
    [attachTile],
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
  render: (ctx) => {
    const typed = ctx as RenderContext<SolidState, SolidConfig>;
    return (
      <WeaselProvider isolate>
        <Viewport config={typed.config} />
      </WeaselProvider>
    );
  },
});
