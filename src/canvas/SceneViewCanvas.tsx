/**
 * `<SceneViewCanvas>` — pointer-inert, read-only render of a `Scene` at a
 * given `View` into its own `<canvas>` DOM element. Step 2 of the detached
 * minimap spec (`docs/superpowers/specs/2026-05-31-detached-minimap-design.md`).
 *
 * The component:
 *   - mounts its own `<canvas>`,
 *   - subscribes to the scene via `useSyncExternalStore(scene.subscribe,
 *     scene.getVersion)` so any scene mutation triggers a re-render,
 *   - dispatches to `renderSceneToCanvas` in a layout effect on every render
 *     so prop changes (`view`, `width`, `height`, `drawOne`, `extraCommands`)
 *     all repaint,
 *   - attaches **no** event listeners (consumers attach their own via
 *     `canvasRef`).
 *
 * Sizing follows `<SceneCanvas>`'s convention: the consumer passes `width` /
 * `height` in CSS pixels. The HTML `width` / `height` attributes of the
 * `<canvas>` (drawing-buffer size) are set to `width × dpr` and `height × dpr`
 * by `renderSceneToCanvas` (via the underlying renderer's `resize`). The CSS
 * size — what the consumer sees on screen — is managed via the `className`
 * prop; no inline styles are emitted (per project rules).
 */
import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Ref } from 'react';
import { renderSceneToCanvas } from './sceneViewRender';
import type { SceneViewDrawOne } from './sceneViewRender';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';
import type { Scene } from '../core/scene/types';

export interface SceneViewCanvasProps<TData, TLayer extends string, TPose> {
  /** Scene to render. Must be the same `Scene` instance passed to whoever
   *  is mutating it; the component subscribes to its version stream and
   *  repaints when the version advances. */
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
   *  view transform. Used by `<MinimapCanvas>` for its visible-window
   *  indicator; available to other consumers that want to overlay a
   *  world-space annotation. */
  extraCommands?: ReadonlyArray<DrawCommand>;
  /** Optional CSS class for sizing / positioning the `<canvas>`. The kit
   *  does not emit inline styles for layout — use a class. */
  className?: string;
  /** Forwarded ref to the underlying `<canvas>`. Consumers attach their own
   *  pointer listeners or call `toBlob` for snapshots through this. */
  canvasRef?: Ref<HTMLCanvasElement>;
}

function SceneViewCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneViewCanvasProps<TData, TLayer, TPose>,
) {
  const { scene, view, width, height, drawOne, extraCommands, className, canvasRef } = props;

  // Subscribe to scene version. The snapshot value isn't used directly —
  // we only need React to re-render the component when the scene mutates.
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const localRef = useRef<HTMLCanvasElement | null>(null);

  // Forward the canvas element to the caller's ref. `useImperativeHandle`-on-
  // ref isn't quite right for a plain element; instead, we expose the same
  // element via a callback ref pattern by writing through to the consumer-
  // supplied ref each time React attaches the canvas.
  const setCanvasRef = (el: HTMLCanvasElement | null): void => {
    localRef.current = el;
    if (typeof canvasRef === 'function') {
      canvasRef(el);
    } else if (canvasRef && typeof canvasRef === 'object') {
      (canvasRef as { current: HTMLCanvasElement | null }).current = el;
    }
  };

  // Render after every commit. `useLayoutEffect` runs synchronously after
  // DOM mutations but before paint, so the first frame the user sees is the
  // scene, not a blank canvas.
  useLayoutEffect(() => {
    const canvas = localRef.current;
    if (!canvas) return;
    renderSceneToCanvas({
      canvas,
      scene,
      view,
      width,
      height,
      drawOne,
      extraCommands: extraCommands as DrawCommand[] | undefined,
    });
  });

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
 * Pointer-inert read-only scene view. See `SceneViewCanvasProps` for the
 * full surface and the module docstring for the rendering model.
 *
 * `forwardRef` is not used because the component is generic over `<TData,
 * TLayer, TPose>` and React's `forwardRef` erases generics. The
 * `canvasRef` prop is the plain-prop equivalent (the spec calls it out as
 * the public surface).
 */
export const SceneViewCanvas = SceneViewCanvasInner;
