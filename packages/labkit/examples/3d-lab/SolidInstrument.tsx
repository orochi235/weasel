import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  WeaselProvider,
  createDispatcher,
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
import { createCamera, type Camera3d } from './camera3d';
import {
  createAreaSelect,
  createInsert,
  createNodeAtPoint,
  createPoseDescriptor,
  createSnap,
  screenBoxOf,
  type Viewport3d,
} from './deps3d';
import { collectGhosts } from './ghosts3d';
import { createRenderer3d, type ChromeBox, type Renderer3d, type SolidDraw } from './renderer3d';
import { createSolidScene, type Pose3, type SolidScene } from './scene3d';
import { dollyAction, orbitAction, useBoxTool, useOrbitTool } from './tools3d';
import './depSchemaAugmentation';

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
  const glCanvas = useSurfaceCanvas();
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
  const [sceneVersion, bumpScene] = useReducer((n: number) => n + 1, 0);

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sizeRef = useRef({ width: 1, height: 1 });
  const originRef = useRef({ x: 0, y: 0 });
  const showChromeRef = useRef(config.showChrome);
  showChromeRef.current = config.showChrome;

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
  useEffect(repaint, [repaint, camera, selection, sceneVersion]);

  useEffect(() => scene.subscribe(bumpScene), [scene]);

  // Preview poses mutate inside the handle without a React render, so the
  // dispatcher's own pump is what drives a ghost frame.
  useEffect(() => dispatcher.subscribe(repaint), [dispatcher, repaint]);

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
      const selected = new Set(selectionRef.current);
      const solids: SolidDraw[] = scene.renderOrderNodes().map((node) => ({
        pose: node.pose,
        kind: node.data.kind,
        color: node.data.color,
        selected: selected.has(node.id),
      }));

      // `moveAction` declares the kit's default `previewHidesSource: true`,
      // where the ghost replaces the solid. The lab keeps the solid drawn at
      // its committed pose instead, so a drag shows what moved and from where.
      for (const ghost of collectGhosts(dispatcher.getInFlightHandles(), scene)) {
        solids.push({
          pose: ghost.pose,
          kind: ghost.kind,
          color: ghost.color,
          selected: false,
          ghost: true,
        });
      }

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
            .map((id) => screenBoxOf(scene, id, viewport))
            .filter((box): box is ChromeBox => box !== null)
            .map((box) => ({
              ...box,
              x: box.x - originRef.current.x,
              y: box.y - originRef.current.y,
            }))
        : [];

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
  }, [glCanvas, surface, tileId, scene, dispatcher]);

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

  const nodeAtPoint = useMemo(
    () => createNodeAtPoint(scene, viewportSource),
    [scene, viewportSource],
  );
  const areaSelect = useMemo(
    () => createAreaSelect(scene, viewportSource, selectionApi),
    [scene, viewportSource, selectionApi],
  );
  const insert = useMemo(() => createInsert(scene, viewportSource), [scene, viewportSource]);
  const poseDescriptor = useMemo(() => createPoseDescriptor(viewportSource), [viewportSource]);
  const snap = useMemo(() => createSnap(), []);

  const camera3d = useMemo(
    () => ({
      get: () => cameraRef.current,
      set: (next: Camera3d) => setCamera(next),
      size: () => sizeRef.current,
    }),
    [],
  );

  // No `history`: `Scene` owns one and exposes no handle to it, so the kit's
  // undo/redo actions have nothing to drive. The toolbar calls scene.undo directly.
  useStandardActions({ selection: selectionApi, scene: scene as never });
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

  // `select.pick` is gated on the active tool declaring `creates-selection`,
  // and eligibility reads the tool through this dep. Without it every
  // capability-gated action stays ineligible and a click selects nothing.
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
        <button type="button" className="td-tool" onClick={() => scene.undo()}>
          undo
        </button>
        <button type="button" className="td-tool" onClick={() => scene.redo()}>
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
