/**
 * `<SceneViewCanvas>` — pointer-inert, read-only render of a `Scene` at a
 * given `View` into its own `<canvas>` DOM element.
 *
 * It paints through `useFrameLoop` rather than from React: a render and an
 * override commit both just mark the surface dirty. The mount paint is
 * synchronous, so the first frame the user sees is the scene, and nothing
 * paints while the canvas is off screen or the tab is hidden.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Ref } from 'react';
import { assignRef, useLatest } from '@weasel-js/react';
import { useFrameLoop } from './useFrameLoop';
import { useLateContentRedraw } from './useLateContentRedraw';
import { useCanvasRenderer, useRedrawOnDensityChange, useRedrawOnRestore } from './useCanvasRenderer';
import { sceneViewFrame } from './sceneViewRender';
import type { RenderSceneToCanvasArgs, SceneViewDrawOne, SceneViewLayers } from './sceneViewRender';
import type { DrawCommand } from '@weasel-js/renderer';
import { normalizeView, type View } from '../core/viewport/view';
import type { Scene } from '../core/scene/types';
import type { Animator } from '@weasel-js/animator';

/** Props for `<SceneViewCanvas>`. */
export interface SceneViewCanvasProps<TData, TLayer extends string, TPose> {
  /** Scene to render. The component subscribes to it and repaints when it
   *  changes. */
  scene: Scene<TData, TLayer, TPose>;
  /** Camera. Applied to scene + `extraCommands` via the renderer's group
   *  transform. */
  view: View;
  /** CSS-pixel width. Drives both layout (via the rendered drawing-buffer
   *  size) and the renderer's coordinate space. */
  width: number;
  /** CSS-pixel height. */
  height: number;
  /** Per-node draw callback. See `SceneViewDrawOne`. The consumer is
   *  responsible for what gets painted — there is no AABB-fill default. */
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Optional extra commands appended after scene commands, inside the same
   *  view transform — a world-space annotation over the scene. */
  extraCommands?: ReadonlyArray<DrawCommand>;
  /** Optional per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the main canvas uses to keep a
   *  scoping-dim treatment consistent across both. Defaults to `() => 1`. */
  alphaFor?: (id: string) => number;
  /** Hide scene layers in this view only, keyed `scene:<layerId>` as on
   *  `<SceneCanvas>` — pass the main canvas's map to keep the two in step. */
  layerVisibility?: SceneViewLayers['layerVisibility'];
  /** Paint order for this view, keyed as `layerVisibility`. */
  layerOrder?: SceneViewLayers['layerOrder'];
  /** Skip nodes and commands that cannot reach this view — the scene slot's
   *  `cull`. Off by default; worth it when the view shows a small part of a
   *  large scene. */
  cull?: boolean;
  /** Where `drawOne`'s output for a node can reach — the scene slot's
   *  `paintBounds`. Defaults to `defaultPaintBounds` when `drawOne` is
   *  `defaultDrawOne`. */
  paintBounds?: RenderSceneToCanvasArgs<TData, TLayer, TPose>['paintBounds'];
  /** Optional animator, as on `<SceneCanvas>`: the view repaints on its ticks
   *  and paints its `colorOverrides`. Pass the main canvas's animator so both
   *  show the same colors. */
  animator?: Animator;
  /** Optional CSS class for positioning the `<canvas>`. Its size is `width` ×
   *  `height`, which the renderer writes as inline style. */
  className?: string;
  /** Forwarded ref to the underlying `<canvas>`. Consumers attach their own
   *  pointer listeners or call `toBlob` for snapshots through this. */
  canvasRef?: Ref<HTMLCanvasElement>;
}

function SceneViewCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneViewCanvasProps<TData, TLayer, TPose>,
) {
  const {
    scene, width, height, drawOne, extraCommands, alphaFor, layerVisibility, layerOrder,
    animator, className, canvasRef, cull, paintBounds,
  } = props;
  const view = normalizeView(props.view);

  // Subscribe to scene version. The snapshot value isn't used directly —
  // we only need React to re-render the component when the scene mutates.
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const localRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvasRef = useCallback((el: HTMLCanvasElement | null): void => {
    localRef.current = el;
    assignRef(canvasRef, el);
  }, [canvasRef]);

  // The thunk defers to `paintRef`, which every committed render republishes
  // from an insertion effect — ahead of the layout effect below, and never
  // from a render React abandoned.
  const lease = useCanvasRenderer();
  const paint = (): boolean => {
    const canvas = localRef.current;
    if (!canvas) return false;
    const commands = sceneViewFrame({
      scene,
      view,
      width,
      height,
      drawOne,
      extraCommands: extraCommands as DrawCommand[] | undefined,
      alphaFor,
      layerVisibility,
      layerOrder,
      colorOverrides: animator?.colorOverrides,
      cull,
      paintBounds,
    });
    return lease.paint(canvas, commands, view, { width, height });
  };
  const paintRef = useLatest(paint);

  const { requestRedraw } = useFrameLoop(
    useCallback(() => paintRef.current(), [paintRef]),
    { target: localRef },
  );

  // Every render marks the surface dirty. No dependency array: the paint
  // reads all of them. The mount paint is the exception: it runs here, in the
  // caller's stack.
  const paintedRef = useRef(false);
  useLayoutEffect(() => {
    if (paintedRef.current) { requestRedraw(); return; }
    paintedRef.current = paintRef.current();
    if (!paintedRef.current) requestRedraw();
  });

  // Override writes never bump the scene version, so the version subscription
  // above cannot see them.
  useEffect(() => scene.overrides.subscribe(requestRedraw), [scene, requestRedraw]);
  useEffect(() => animator?.onTick(requestRedraw), [animator, requestRedraw]);
  useLateContentRedraw(requestRedraw);
  useRedrawOnRestore(lease, requestRedraw);
  useRedrawOnDensityChange(requestRedraw);

  // A remount (StrictMode) paints its first frame in place again.
  useEffect(() => () => { paintedRef.current = false; }, []);

  return (
    <canvas
      ref={setCanvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
}

/**
 * Pointer-inert read-only scene view. It attaches no event listeners;
 * consumers attach their own through `canvasRef`, a plain prop because
 * `forwardRef` erases the component's generics. `width` and `height` are CSS
 * pixels, which the renderer writes as inline style, so `className` can
 * position the canvas and cannot resize it.
 */
export const SceneViewCanvas = SceneViewCanvasInner;
