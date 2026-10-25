import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { assignRef, useLatest } from '@weasel-js/react';
import type { Tool } from '@weasel-js/routing';
import { PointerProviderIfRoot, useDeviceProfile } from '@weasel-js/core';
import { usePointerPosition } from '@weasel-js/routing/react';
import {
  MINIMAP_CENTER, MINIMAP_PAN, minimapCenterAction, minimapPanAction,
} from './actions';
import { createLinkedCursorLayer } from './layers';
import type { CanvasSize, SurfaceSizeProps, ViewApi } from '@weasel-js/core';
import { SceneViewCanvas } from '@weasel-js/core';
import { computeIndicatorCommand } from './minimapMath';
import { useFitView } from './useFitView';
import { usePublishPointer } from './usePublishPointer';
import type { IndicatorStyle, MinimapFit } from './minimapMath';
import type { SceneViewDrawOne, SceneViewLayers } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core';
import { normalizeView, type View } from '@weasel-js/core';
import type { Scene } from '@weasel-js/core';
import type { PoseDescriptor } from '@weasel-js/core';
import type { Animator } from '@weasel-js/animator';
import { AUTO_POSE_DESCRIPTOR } from '@weasel-js/core';
import { accentColorOf } from '@weasel-js/core';

/** Props for `<MinimapCanvas>`. */
export interface MinimapCanvasProps<TData, TLayer extends string, TPose> extends SurfaceSizeProps {
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
  /** Consumer's draw callback. Applied through the derived fit view; same
   *  signature as `<SceneCanvas>`'s scene-slot `drawOne` so the consumer
   *  can reuse it (typically simplified — just colored AABBs). */
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Fit policy. Defaults to `"scene"` (AABB union of leaf poses). See
   *  `MinimapFit` for the full shape.
   *
   *  `"scene"` frames **document** poses, not `scene.overrides` — a node
   *  moved by an override paints where the override puts it, outside the
   *  frame if it goes there, rather than making the whole minimap rescale on
   *  every frame of a drag or a settle. `"live"` frames the overrides too. */
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
  /** CSS class for the canvas. Its size is `width` × `height` unless a rule
   *  on this class sizes it. Given neither, the minimap fills its parent and
   *  fits the scene to the box it measures, again on every resize. */
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
    { spec: { kind: 'pointerDown' }, actionId: MINIMAP_CENTER, opts: { id: 'minimap.pointerDown' } },
    { spec: { kind: 'drag' }, actionId: MINIMAP_PAN, opts: { id: 'minimap.drag' } },
  ],
};
const TOOLS_BY_ID: ReadonlyMap<string, Tool> = new Map([[MINIMAP_INPUT.id, MINIMAP_INPUT]]);
const CHANNELS = { wheel: false, pinch: false, contextMenu: false, ingest: false } as const;

function MinimapCanvasInner<TData, TLayer extends string, TPose>(
  props: MinimapCanvasProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    mainView: mainViewProp,
    mainViewDims,
    onMainViewChange,
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
    onResize,
  } = props;
  const [measured, setMeasured] = useState<CanvasSize | null>(null);
  const width = props.width ?? measured?.width ?? 0;
  const height = props.height ?? measured?.height ?? 0;
  const handleResize = useCallback((size: CanvasSize) => {
    setMeasured(size);
    onResize?.(size);
  }, [onResize]);
  const mainView = normalizeView(mainViewProp);

  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const fitView = useFitView(scene, width, height, fit, descriptor);

  const indicatorCmd = useMemo<DrawCommand>(() => {
    return computeIndicatorCommand(mainView, mainViewDims, indicatorStyle, fitView);
  }, [mainView, mainViewDims, indicatorStyle, fitView]);

  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainViewRef = useLatest(mainView);
  const mainViewDimsRef = useLatest(mainViewDims);
  const onMainViewChangeRef = useLatest(onMainViewChange);
  const fitViewRef = useLatest(fitView);

  // The main canvas's camera, which is what the minimap's actions move.
  const rootView = useMemo<ViewApi>(() => ({
    get: () => mainViewRef.current,
    set: (v) => onMainViewChangeRef.current(v),
    hostSize: () => mainViewDimsRef.current,
  }), [mainViewRef, onMainViewChangeRef, mainViewDimsRef]);
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
  }, [fitViewRef]);

  useGestureDispatcher({
    canvasRef: localCanvasRef,
    actions: actions!,
    entriesById: TOOLS_BY_ID,
    clientToWorld,
    keyboard: false,
    channels: CHANNELS,
  });

  usePublishPointer(localCanvasRef, clientToWorld, id);

  const pointer = usePointerPosition();
  const { dpr } = useDeviceProfile();
  const cursorLayer = useMemo(() => createLinkedCursorLayer({
    id: `${id}.cursor`,
    pointer: () => pointer,
    color: () => accentColorOf(localCanvasRef.current),
  }), [id, pointer]);

  const extraCommands = useMemo<DrawCommand[]>(() => [
    indicatorCmd,
    ...cursorLayer.draw({ viewId: id }, fitView, { width, height, dpr }),
  ], [indicatorCmd, cursorLayer, id, fitView, width, height, dpr]);

  // `<SceneViewCanvas>` doesn't expose its element except via `canvasRef`, so
  // we route both our internal ref and the consumer's ref through one setter.
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    localCanvasRef.current = el;
    assignRef(canvasRef, el);
  }, [canvasRef]);

  return (
    <SceneViewCanvas
      scene={scene}
      view={fitView}
      width={props.width}
      height={props.height}
      onResize={handleResize}
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
 * Opinionated minimap on a canvas of its own. Renders the same `scene` the
 * main canvas is showing through a derived "fit" view, and overlays a dashed
 * indicator of where the main canvas is looking. Press anywhere in it to
 * recenter the main view on that world point; drag to pan continuously.
 *
 * Its dispatcher, actions and deps are its own, so it never competes with
 * the main canvas for input. Put one `<PointerContextProvider>` around it and
 * the main canvas for linked cursors both ways.
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
