/**
 * `<MinimapCanvas>` — opinionated minimap built on top of `<SceneViewCanvas>`.
 * Step 4 of the detached-minimap spec
 * (`docs/superpowers/specs/2026-05-31-detached-minimap-design.md`).
 *
 * Renders the same `scene` the main canvas is showing, through a derived
 * "fit" view, and overlays a dashed visible-window indicator showing where
 * the main canvas is currently looking. Click anywhere in the minimap to
 * recenter the main view on that world point; drag to pan continuously.
 *
 * Pointer-isolated from the main canvas: native `pointerdown` / `pointermove`
 * / `pointerup` / `pointercancel` listeners are attached to the underlying
 * `<canvas>` via `addEventListener` (not React-synthetic) with
 * `setPointerCapture`, so a drag that leaves the minimap rect still tracks
 * cleanly. No participation in the tool / action / dispatcher layer — this
 * is a single one-off click+drag gesture with a fixed effect (per the spec).
 */
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Ref } from 'react';
import { SceneViewCanvas } from './SceneViewCanvas';
import {
  computeFitView,
  computeIndicatorCommand,
} from './minimapMath';
import type { IndicatorStyle, MinimapFit } from './minimapMath';
import type { SceneViewDrawOne } from './sceneViewRender';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';
import type { Scene } from '../core/scene/types';
import type { Bounds } from '../core/viewport/fitViewToBounds';

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
   *  `MinimapFit` for the full shape. */
  fit?: MinimapFit<TData, TLayer, TPose>;
  /** Pose → AABB. Defaults to identity (`pose as Bounds`), matching
   *  `sceneAdapter` / `useSelectTool`. */
  poseBounds?: (pose: TPose) => Bounds;
  /** Optional per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the main canvas uses so a
   *  scoping-dim treatment shows up in the minimap too. */
  alphaFor?: (id: string) => number;
  /** Visual tuning of the indicator stroke. */
  indicatorStyle?: IndicatorStyle;
  /** CSS class for sizing / positioning the canvas. */
  className?: string;
  /** Forwarded ref to the underlying `<canvas>`. */
  canvasRef?: Ref<HTMLCanvasElement>;
}

const IDENTITY_POSE_BOUNDS = (p: unknown): Bounds => p as Bounds;

function MinimapCanvasInner<TData, TLayer extends string, TPose>(
  props: MinimapCanvasProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    mainView,
    mainViewDims,
    onMainViewChange,
    width,
    height,
    drawOne,
    alphaFor,
    fit = 'scene',
    poseBounds,
    indicatorStyle,
    className,
    canvasRef,
  } = props;

  // Subscribe to scene version so the fit view recomputes when the scene
  // mutates. `<SceneViewCanvas>` also subscribes, but it owns its own
  // rendering; we need the version *here* to invalidate the memoized fit.
  const sceneVersion = useSyncExternalStore(
    scene.subscribe,
    scene.getVersion,
    scene.getVersion,
  );

  const effectivePoseBounds = poseBounds ?? (IDENTITY_POSE_BOUNDS as (p: TPose) => Bounds);

  const fitView = useMemo<View>(() => {
    return computeFitView(scene, { width, height }, fit, effectivePoseBounds);
    // `sceneVersion` participates so the memo re-evaluates after scene mutations.
    // `effectivePoseBounds` is stable when the prop is omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sceneVersion, width, height, fit, effectivePoseBounds]);

  const indicatorCmd = useMemo<DrawCommand>(() => {
    return computeIndicatorCommand(mainView, mainViewDims, indicatorStyle);
  }, [mainView, mainViewDims, indicatorStyle]);

  const extraCommands = useMemo<DrawCommand[]>(() => [indicatorCmd], [indicatorCmd]);

  // -------------------------------------------------------------------------
  // Pointer handling
  // -------------------------------------------------------------------------
  //
  // We attach native listeners (not React-synthetic) because:
  //   1. `setPointerCapture` semantics demand the element-level event.
  //   2. We need pointermove + pointerup/pointercancel that fire even when
  //      the pointer leaves the minimap's bounding rect — capture routes
  //      them back to the canvas regardless.
  //
  // The "latest" pattern (refs holding the current mainView / dims / setter
  // / fitView) lets the listeners read up-to-date values without re-binding
  // every frame.

  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragActiveRef = useRef(false);
  const capturedPointerIdRef = useRef<number | null>(null);

  const mainViewRef = useRef(mainView);
  const mainViewDimsRef = useRef(mainViewDims);
  const onMainViewChangeRef = useRef(onMainViewChange);
  const fitViewRef = useRef(fitView);
  mainViewRef.current = mainView;
  mainViewDimsRef.current = mainViewDims;
  onMainViewChangeRef.current = onMainViewChange;
  fitViewRef.current = fitView;

  const recenterFromPointer = useCallback((ev: PointerEvent) => {
    const canvas = localCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const fv = fitViewRef.current;
    // Minimap-px → world: invert the fit view.
    const worldX = fv.x + px / fv.scale.x;
    const worldY = fv.y + py / fv.scale.y;
    const mv = mainViewRef.current;
    const dims = mainViewDimsRef.current;
    const next: View = {
      x: worldX - dims.width / (2 * mv.scale.x),
      y: worldY - dims.height / (2 * mv.scale.y),
      scale: { x: mv.scale.x, y: mv.scale.y },
    };
    onMainViewChangeRef.current(next);
  }, []);

  const handlePointerDown = useCallback((ev: PointerEvent) => {
    const canvas = localCanvasRef.current;
    if (!canvas) return;
    // Only act on the primary button for mouse; touch/pen always proceed.
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      // jsdom + some environments throw on setPointerCapture for synthetic
      // events; ignore — we still drive the recenter via the listeners.
    }
    dragActiveRef.current = true;
    capturedPointerIdRef.current = ev.pointerId;
    recenterFromPointer(ev);
  }, [recenterFromPointer]);

  const handlePointerMove = useCallback((ev: PointerEvent) => {
    if (!dragActiveRef.current) return;
    if (capturedPointerIdRef.current !== null
      && ev.pointerId !== capturedPointerIdRef.current) {
      return;
    }
    recenterFromPointer(ev);
  }, [recenterFromPointer]);

  const releaseCapture = useCallback((ev: PointerEvent) => {
    const canvas = localCanvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture?.(ev.pointerId)) {
          canvas.releasePointerCapture(ev.pointerId);
        }
      } catch {
        // Same rationale as setPointerCapture: tolerate environment quirks.
      }
    }
    dragActiveRef.current = false;
    capturedPointerIdRef.current = null;
  }, []);

  // Wire native listeners on the canvas. `<SceneViewCanvas>` doesn't expose
  // its element except via `canvasRef`, so we route both our internal ref
  // and the consumer's ref through a single setter.
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    localCanvasRef.current = el;
    if (typeof canvasRef === 'function') {
      canvasRef(el);
    } else if (canvasRef && typeof canvasRef === 'object') {
      (canvasRef as { current: HTMLCanvasElement | null }).current = el;
    }
  }, [canvasRef]);

  useLayoutEffect(() => {
    const canvas = localCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', releaseCapture);
    canvas.addEventListener('pointercancel', releaseCapture);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', releaseCapture);
      canvas.removeEventListener('pointercancel', releaseCapture);
    };
  }, [handlePointerDown, handlePointerMove, releaseCapture]);

  return (
    <SceneViewCanvas
      scene={scene}
      view={fitView}
      width={width}
      height={height}
      drawOne={drawOne}
      extraCommands={extraCommands}
      alphaFor={alphaFor}
      className={className}
      canvasRef={setCanvasRef}
    />
  );
}

/**
 * Opinionated minimap. See `MinimapCanvasProps` for the full surface and
 * the module docstring for the rendering / pointer model.
 *
 * `forwardRef` is not used because the component is generic over
 * `<TData, TLayer, TPose>` and React's `forwardRef` erases generics. The
 * `canvasRef` prop is the plain-prop equivalent.
 */
export const MinimapCanvas = MinimapCanvasInner;
