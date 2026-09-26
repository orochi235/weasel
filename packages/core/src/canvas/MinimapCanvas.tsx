/**
 * `<MinimapCanvas>` — opinionated minimap on a canvas of its own, built on
 * `<SceneViewCanvas>`.
 *
 * Renders the same `scene` the main canvas is showing, through a derived
 * "fit" view, and overlays a dashed visible-window indicator showing where
 * the main canvas is currently looking. Press anywhere in the minimap to
 * recenter the main view on that world point; drag to pan continuously.
 *
 * Input runs on a dispatcher of its own, through the same `minimap.center` /
 * `minimap.pan` actions the in-surface minimap (`createMinimapContribution`)
 * binds. It publishes its pointer into the pointer store in scope, and draws a
 * crosshair wherever that store says the pointer is on another surface — put
 * one `<PointerContextProvider>` around it and the main canvas for linked
 * cursors both ways.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Ref } from 'react';
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  useActionsRegistry,
  useDepSource,
  useGestureDispatcher,
} from '@weasel-js/routing/react';
import type { Tool } from '@weasel-js/routing';
import { PointerProviderIfRoot } from './SceneCanvas/PointerProviderIfRoot';
import { usePointerContext, usePointerPosition } from 'features/pointer/PointerContext';
import {
  MINIMAP_CENTER, MINIMAP_PAN, minimapCenterAction, minimapPanAction,
} from 'features/minimap/actions';
import { createLinkedCursorLayer } from 'features/minimap/layers';
import type { ViewApi } from 'interactions/actions/depSchema';
import { SceneViewCanvas } from './SceneViewCanvas';
import {
  computeFitView,
  computeIndicatorCommand,
} from './minimapMath';
import type { IndicatorStyle, MinimapFit } from './minimapMath';
import type { SceneViewDrawOne, SceneViewLayers } from './sceneViewRender';
import type { DrawCommand } from '../renderer/DrawCommand';
import { normalizeView, type View } from '../core/viewport/view';
import type { Scene } from '../core/scene/types';
import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import type { Animator } from '../animation/types';
import { AUTO_POSE_DESCRIPTOR } from '../interactions/actions/resize/autoPoseDescriptor';

/** Props for `<MinimapCanvas>`. */
export interface MinimapCanvasProps<TData, TLayer extends string, TPose> {
  /** Same scene the main canvas is rendering. */
  scene: Scene<TData, TLayer, TPose>;
  /** Main canvas's view — used to position the visible-window indicator and
   *  to preserve `scale` when the minimap recenters. */
  mainView: View;
  /** Main canvas's CSS-pixel dims. Used to compute the visible-window rect
   *  and the recenter offset. */
  mainViewDims: { width: number; height: number };
  /** Setter called on click (single recenter) and during drag (continuous
   *  recenter). Receives a `View` with the same `scale` as `mainView` and
   *  `(x, y)` shifted so the pointer's world point lands at the main
   *  canvas's center. */
  onMainViewChange: (next: View) => void;
  /** Minimap's own CSS-pixel dims. */
  width: number;
  height: number;
  /** Consumer's draw callback. Applied through the derived fit view; same
   *  signature as `<SceneCanvas>`'s scene-slot `drawOne` so the consumer
   *  can reuse it (typically simplified — just colored AABBs). */
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Fit policy. Defaults to `"scene"` (AABB union of leaf poses). See
   *  `MinimapFit` for the full shape.
   *
   *  Framing is derived from **document** poses, not `scene.overrides` — a
   *  node moved by an override paints where the override puts it, outside the
   *  frame if it goes there, rather than making the whole minimap rescale on
   *  every frame of a drag or a settle. */
  fit?: MinimapFit<TData, TLayer, TPose>;
  /** How to read poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** Optional per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the main canvas uses so a
   *  scoping-dim treatment shows up in the minimap too. */
  alphaFor?: (id: string) => number;
  /** Hide scene layers in the minimap, keyed `scene:<layerId>` as on
   *  `<SceneCanvas>` — pass the main canvas's map so both show the same set. */
  layerVisibility?: SceneViewLayers['layerVisibility'];
  /** Paint order for the minimap, keyed as `layerVisibility`. */
  layerOrder?: SceneViewLayers['layerOrder'];
  /** Optional animator: the minimap repaints on its ticks and paints its
   *  `colorOverrides`. Pass the main canvas's animator so both show the same
   *  colors. */
  animator?: Animator;
  /** Visual tuning of the indicator stroke. */
  indicatorStyle?: IndicatorStyle;
  /** CSS class for sizing / positioning the canvas. */
  className?: string;
  /** Forwarded ref to the underlying `<canvas>`. */
  canvasRef?: Ref<HTMLCanvasElement>;
  /** The view id this minimap publishes its pointer under. Default
   *  `'minimap'`. */
  id?: string;
}

/** The minimap's own bindings. Unscoped: this dispatcher routes no views, so
 *  every input on it is the minimap's. */
const MINIMAP_INPUT: Tool = {
  id: 'minimap',
  eligibility: { always: true },
  bindings: [
    { spec: { kind: 'pointerDown' }, actionId: MINIMAP_CENTER },
    { spec: { kind: 'drag' }, actionId: MINIMAP_PAN },
  ],
};
const TOOLS_BY_ID: ReadonlyMap<string, Tool> = new Map([[MINIMAP_INPUT.id, MINIMAP_INPUT]]);
const CHANNELS = { wheel: false, pinch: false, contextMenu: false, ingest: false } as const;
const FALLBACK_CURSOR_COLOR = '#4c8dff';

function MinimapCanvasInner<TData, TLayer extends string, TPose>(
  props: MinimapCanvasProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    mainView: mainViewProp,
    mainViewDims,
    onMainViewChange,
    width,
    height,
    drawOne,
    alphaFor,
    layerVisibility,
    layerOrder,
    animator,
    fit = 'scene',
    poseDescriptor,
    indicatorStyle,
    className,
    canvasRef,
    id = 'minimap',
  } = props;
  const mainView = normalizeView(mainViewProp);

  // Subscribe to scene version so the fit view recomputes when the scene
  // mutates. `<SceneViewCanvas>` also subscribes, but it owns its own
  // rendering; we need the version *here* to invalidate the memoized fit.
  const sceneVersion = useSyncExternalStore(
    scene.subscribe,
    scene.getVersion,
    scene.getVersion,
  );

  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;

  const fitView = useMemo<View>(() => {
    return computeFitView(scene, { width, height }, fit, descriptor);
    // `sceneVersion` participates so the memo re-evaluates after scene mutations.
    // `descriptor` is stable when the prop is omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sceneVersion, width, height, fit, descriptor]);

  const indicatorCmd = useMemo<DrawCommand>(() => {
    return computeIndicatorCommand(mainView, mainViewDims, indicatorStyle);
  }, [mainView, mainViewDims, indicatorStyle]);

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  //
  // The "latest" pattern (refs holding the current mainView / dims / setter
  // / fitView) lets the dep and the listeners read up-to-date values without
  // re-binding every frame.

  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainViewRef = useRef(mainView);
  const mainViewDimsRef = useRef(mainViewDims);
  const onMainViewChangeRef = useRef(onMainViewChange);
  const fitViewRef = useRef(fitView);
  mainViewRef.current = mainView;
  mainViewDimsRef.current = mainViewDims;
  onMainViewChangeRef.current = onMainViewChange;
  fitViewRef.current = fitView;

  // The main canvas's camera, which is what the minimap's actions move.
  const rootView = useMemo<ViewApi>(() => ({
    get: () => mainViewRef.current,
    set: (v) => onMainViewChangeRef.current(v),
    hostSize: () => mainViewDimsRef.current,
  }), []);
  useDepSource('rootView', () => rootView);

  const actions = useActionsRegistry();
  useEffect(() => {
    if (!actions) return;
    const off = [actions.register(minimapCenterAction()), actions.register(minimapPanAction())];
    return () => { for (const u of off) u(); };
  }, [actions]);

  /** Client point → world, through the fit camera. */
  const clientToWorld = useCallback((cx: number, cy: number) => {
    const rect = localCanvasRef.current?.getBoundingClientRect();
    const fv = fitViewRef.current;
    return {
      x: fv.x + (cx - (rect?.left ?? 0)) / fv.scale.x,
      y: fv.y + (cy - (rect?.top ?? 0)) / fv.scale.y,
    };
  }, []);

  useGestureDispatcher({
    canvasRef: localCanvasRef,
    actions: actions!,
    toolsById: TOOLS_BY_ID,
    clientToWorld,
    keyboard: false,
    channels: CHANNELS,
  });

  // -------------------------------------------------------------------------
  // Linked cursor
  // -------------------------------------------------------------------------

  const pointerStore = usePointerContext();
  useEffect(() => {
    const el = localCanvasRef.current;
    if (!el || !pointerStore) return;
    const onMove = (e: PointerEvent): void => {
      const w = clientToWorld(e.clientX, e.clientY);
      pointerStore.set({ worldX: w.x, worldY: w.y, viewId: id });
    };
    const onLeave = (e: PointerEvent): void => {
      if (e.buttons !== 0) return;
      if (pointerStore.get()?.viewId === id) pointerStore.set(null);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [pointerStore, clientToWorld, id]);

  const pointer = usePointerPosition();
  const cursorLayer = useMemo(() => createLinkedCursorLayer({
    id: `${id}.cursor`,
    pointer: () => pointer,
    color: () => {
      const el = localCanvasRef.current;
      return (el && getComputedStyle(el).getPropertyValue('--wzl-accent').trim()) || FALLBACK_CURSOR_COLOR;
    },
  }), [id, pointer]);

  const extraCommands = useMemo<DrawCommand[]>(() => [
    indicatorCmd,
    ...cursorLayer.draw({ viewId: id }, fitView, { width, height }),
  ], [indicatorCmd, cursorLayer, id, fitView, width, height]);

  // `<SceneViewCanvas>` doesn't expose its element except via `canvasRef`, so
  // we route both our internal ref and the consumer's ref through one setter.
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    localCanvasRef.current = el;
    if (typeof canvasRef === 'function') {
      canvasRef(el);
    } else if (canvasRef && typeof canvasRef === 'object') {
      (canvasRef as { current: HTMLCanvasElement | null }).current = el;
    }
  }, [canvasRef]);

  return (
    <SceneViewCanvas
      scene={scene}
      view={fitView}
      width={width}
      height={height}
      drawOne={drawOne}
      extraCommands={extraCommands}
      alphaFor={alphaFor}
      layerVisibility={layerVisibility}
      layerOrder={layerOrder}
      animator={animator}
      className={className}
      canvasRef={setCanvasRef}
    />
  );
}

/**
 * Opinionated minimap. See `MinimapCanvasProps` for the full surface and
 * the module docstring for the rendering / input model.
 *
 * Its dispatcher, actions and deps are its own, so it never competes with
 * the main canvas for input. The pointer store is shared when one is in scope.
 *
 * `forwardRef` is not used because the component is generic over
 * `<TData, TLayer, TPose>` and React's `forwardRef` erases generics. The
 * `canvasRef` prop is the plain-prop equivalent.
 */
export function MinimapCanvas<TData, TLayer extends string, TPose>(
  props: MinimapCanvasProps<TData, TLayer, TPose>,
) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <PointerProviderIfRoot>
            <MinimapCanvasInner {...props} />
          </PointerProviderIfRoot>
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}
