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
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Ref } from 'react';
import { assignRef } from '@weasel-js/react';
import { useCanvasSurface } from './useCanvasSurface';
import type { CanvasRendererLease } from './canvasRenderer';
import { SurfaceCanvas } from './SurfaceCanvas';
import { useSurfaceSize, type SurfaceSizeProps } from './useSurfaceSize';
import { sceneViewFrame } from './sceneViewRender';
import { paintOverrideSources } from './paintOverrides';
import { subscribeToSources } from '../core/layers/render';
import type { RenderSceneToCanvasArgs, SceneViewDrawOne, SceneViewLayers } from './sceneViewRender';
import type { DrawCommand } from '@weasel-js/renderer';
import { normalizeView, type View } from '../core/viewport/view';
import type { Scene } from '../core/scene/types';
import type { Animator } from '@weasel-js/animator';
import { WorkerSceneView, type WorkerCanvasHandle } from './renderWorker/WorkerSceneView';
import type { FollowedClock } from './renderWorker/startSceneRenderWorker';

/** What `<SceneViewCanvas>` takes whether the page or a worker paints it. */
interface SceneViewCanvasCommon<TData, TLayer extends string, TPose> extends SurfaceSizeProps {
  /** Scene to render. The component subscribes to it and repaints when it
   *  changes. */
  scene: Scene<TData, TLayer, TPose>;
  /** Camera. Applied to scene + `extraCommands` via the renderer's group
   *  transform. */
  view: View;
  /** Optional per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the main canvas uses to keep a
   *  scoping-dim treatment consistent across both. Defaults to `() => 1`. A
   *  worker view calls it on the page and sends the alphas that changed. */
  alphaFor?: (id: string) => number;
  /** Optional extra commands appended after scene commands, inside the same
   *  view transform — a world-space annotation over the scene. */
  extraCommands?: ReadonlyArray<DrawCommand>;
  /** Hide scene layers in this view only, keyed `scene:<layerId>` as on
   *  `<SceneCanvas>` — pass the main canvas's map to keep the two in step. */
  layerVisibility?: SceneViewLayers['layerVisibility'];
  /** Paint order for this view, keyed as `layerVisibility`. */
  layerOrder?: SceneViewLayers['layerOrder'];
  /** Skip nodes and commands that cannot reach this view — the scene slot's
   *  `cull`. Off by default; worth it when the view shows a small part of a
   *  large scene. */
  cull?: boolean;
  /** Optional CSS class for the `<canvas>`. Its size is `width` × `height`
   *  unless a rule on this class sizes it. */
  className?: string;
  /** Forwarded ref to the underlying `<canvas>`. Consumers attach their own
   *  pointer listeners or call `toBlob` for snapshots through this. */
  canvasRef?: Ref<HTMLCanvasElement>;
}

/** The page paints the view: `drawOne` and the props beside it are functions it calls. */
interface PagePaintedView<TData, TLayer extends string, TPose> {
  /** Per-node draw callback. See `SceneViewDrawOne`. The consumer is
   *  responsible for what gets painted — there is no AABB-fill default. */
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Where `drawOne`'s output for a node can reach — the scene slot's
   *  `paintBounds`. Defaults to `defaultPaintBounds` when `drawOne` is
   *  `defaultDrawOne`. */
  paintBounds?: RenderSceneToCanvasArgs<TData, TLayer, TPose>['paintBounds'];
  /** Optional animator, as on `<SceneCanvas>`: the view repaints on its ticks
   *  and paints its `colorOverrides` and `trimOverrides`. Pass the main canvas's
   *  animator so both show the same colors and trims. */
  animator?: Animator;
  worker?: undefined;
  workerRef?: undefined;
  clock?: undefined;
}

/** A worker paints the view into this canvas, handed to it with `transferControlToOffscreen`:
 *  the page sends it only what changed in the scene. */
interface WorkerPaintedView {
  /** Start the worker, whose module calls `serveSceneRender` from `@weasel-js/core/render-worker`
   *  — `() => new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })`.
   *  Called once per mount; the worker is stopped on unmount. A function cannot cross to a
   *  worker, so what paints a node (`drawOne`, the node shapes, fonts and shaders it needs)
   *  is the worker module's to set up. So is an animation: the worker runs its own animator,
   *  and the page plays its programs through `workerRef`, so `animator` does not apply. */
  worker: () => Worker;
  /** Reads what the worker's canvas shows, in place of `toBlob` on the canvas, and reaches the
   *  worker's animator, which plays the programs the worker module registered by key. */
  workerRef?: Ref<WorkerCanvasHandle>;
  /** A page clock the worker's animator follows: its pause, rate and seeks reach the
   *  animations. Without one they run on the page's frame times. */
  clock?: FollowedClock;
  drawOne?: undefined;
  paintBounds?: undefined;
  animator?: undefined;
}

/** Props for `<SceneViewCanvas>`. */
export type SceneViewCanvasProps<TData, TLayer extends string, TPose> = SceneViewCanvasCommon<TData, TLayer, TPose>
  & (PagePaintedView<TData, TLayer, TPose> | WorkerPaintedView);

function PageSceneView<TData, TLayer extends string, TPose>(
  props: SceneViewCanvasCommon<TData, TLayer, TPose> & PagePaintedView<TData, TLayer, TPose>,
) {
  const {
    scene, drawOne, extraCommands, alphaFor, layerVisibility, layerOrder,
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
  const { width, height } = useSurfaceSize(props, localRef);

  const paint = (lease: CanvasRendererLease): boolean => {
    const canvas = localRef.current;
    if (!canvas || width === 0 || height === 0) return false;
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
      overrides: animator,
      cull,
      paintBounds,
    });
    return lease.paint(canvas, commands, view, { width, height });
  };
  const { requestRedraw } = useCanvasSurface(paint, { target: localRef, onCommit: 'paint', size: { width, height } });

  // Override writes never bump the scene version, so the version subscription
  // above cannot see them.
  useEffect(() => scene.overrides.subscribe(requestRedraw), [scene, requestRedraw]);
  useEffect(() => scene.scroll?.subscribe(requestRedraw), [scene, requestRedraw]);
  useEffect(() => animator?.onTick(requestRedraw), [animator, requestRedraw]);
  useEffect(() => subscribeToSources(paintOverrideSources(animator))(requestRedraw), [animator, requestRedraw]);

  return (
    <SurfaceCanvas
      ref={setCanvasRef}
      width={props.width}
      height={props.height}
      className={className}
    />
  );
}

/**
 * Pointer-inert read-only scene view. It attaches no event listeners;
 * consumers attach their own through `canvasRef`, a plain prop because
 * `forwardRef` erases the component's generics. `width` and `height` are CSS
 * pixels and size the drawing buffer; a `className` rule that sizes the
 * element stretches that buffer to fit. Given neither, it fills its parent.
 */
export function SceneViewCanvas<TData, TLayer extends string, TPose>(
  props: SceneViewCanvasProps<TData, TLayer, TPose>,
) {
  return props.worker ? <WorkerSceneView {...props} worker={props.worker} /> : <PageSceneView {...props} drawOne={props.drawOne!} />;
}
