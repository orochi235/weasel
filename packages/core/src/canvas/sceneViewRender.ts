/**
 * `renderSceneToCanvas` — substrate for detached, read-only scene views
 * (`<SceneViewCanvas>` / `<MinimapCanvas>`). Given a `<canvas>`, a `Scene`,
 * a `View`, and a per-node `drawOne`, render one frame.
 *
 * Step 1 of the detached-minimap spec
 * (`docs/superpowers/specs/2026-05-31-detached-minimap-design.md`). The full
 * `<SceneCanvas>` render pipeline does much more than this (slots, layer
 * ordering, debug sinks, tool overlays). The helper deliberately re-implements
 * the small subset needed for a non-interactive scene view rather than
 * refactoring `<SceneCanvas>` to share code — the spec calls for that
 * dedupe as a follow-up.
 *
 * Note: this duplicates `<SceneCanvas>`'s GL setup + view-wrap pattern in
 * miniature. When `<SceneCanvas>` is eventually migrated onto this helper,
 * the duplication collapses; until then, keep the two render paths
 * in sync by hand where it matters (DPR handling, viewToMat3 wrap).
 */

import { WeaselRenderer } from '../renderer/WeaselRenderer';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { View } from '../core/viewport/view';
import type { Node, Scene } from '../core/scene/types';
import { wrapNodeOutput } from './wrapNodeOutput';

/**
 * Per-node draw function. Mirrors the scene-slot `drawOne` signature on
 * `<SceneCanvas>` (`SceneSlotConfig.drawOne`) so consumers can reuse the
 * same callback (or a simplified variant) between a main canvas and a
 * detached scene-view canvas.
 *
 * The function is called once per node in `scene.renderOrder()`. Returned
 * commands are in world coords; the caller's `view` is applied at the
 * group level (see `renderSceneToCanvas`'s implementation).
 */
export type SceneViewDrawOne<TData, TLayer extends string, TPose> = (
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view: View,
) => DrawCommand[];

export interface RenderSceneToCanvasArgs<TData, TLayer extends string, TPose> {
  /** The DOM canvas to paint into. The helper owns its WebGL2 context: the
   *  first call on a given canvas creates a renderer and stashes it; subsequent
   *  calls reuse the same renderer (and resize the drawing buffer on dim
   *  changes). */
  canvas: HTMLCanvasElement;
  /** Scene to walk. `scene.renderOrder()` provides the per-node order. */
  scene: Scene<TData, TLayer, TPose>;
  /** Camera view applied to scene + extras (both ride the same world→screen
   *  transform; extras living in screen space should be supplied via a
   *  separately-prepared `extraCommands` group or rendered outside this
   *  helper). */
  view: View;
  /** CSS-pixel size. The drawing buffer is set to `width × dpr` and
   *  `height × dpr`; CSS size to `width` / `height`. */
  width: number;
  height: number;
  /** Per-node draw callback. */
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>;
  /** Optional commands appended after the scene-node output. Used for the
   *  minimap's visible-window indicator. Wrapped in the same view transform
   *  as scene commands. */
  extraCommands?: DrawCommand[];
  /** Optional per-id alpha multiplier, mirroring `<SceneCanvas>`'s scene-slot
   *  `alphaFor`. Pass the same function the main canvas uses to keep a
   *  scoping-dim treatment consistent across both. Defaults to `() => 1`. */
  alphaFor?: (id: string) => number;
  /** Optional device-pixel ratio. Defaults to `window.devicePixelRatio || 1`
   *  when available, otherwise 1. Tests typically pin this to 1 or 2. */
  dpr?: number;
}

interface CacheEntry {
  renderer: WeaselRenderer;
  width: number;
  height: number;
  dpr: number;
}

/**
 * Per-canvas renderer cache. We can't put state on the canvas element
 * (would leak into DOM); a module-level `WeakMap` keyed by the canvas
 * lets us reuse the WeaselRenderer across calls while letting GC reclaim
 * everything when the canvas unmounts.
 */
const RENDERER_CACHE: WeakMap<HTMLCanvasElement, CacheEntry> = new WeakMap();

/**
 * Test seam: inspect the cached renderer for a canvas without exporting
 * the cache itself. Returns `undefined` if no renderer has been mounted
 * on this canvas yet.
 *
 * Not part of the kit's public surface — consumers should not rely on
 * this. (Step 6 of the spec exports the React components; this internal
 * is never re-exported from `src/index.ts`.)
 */
export function __getCachedRendererForTest(
  canvas: HTMLCanvasElement,
): WeaselRenderer | undefined {
  return RENDERER_CACHE.get(canvas)?.renderer;
}

/**
 * Build the DrawCommand list that `renderSceneToCanvas` would dispatch.
 *
 * Pure — no GL, no DOM, no side effects. Iterates `scene.renderOrder()`,
 * calls `drawOne` per node, appends any `extraCommands`, and wraps the
 * combined list in a single `{ kind: 'group', transform: viewToMat3(view) }`
 * so the output is in screen space.
 *
 * Each node's commands additionally go through `wrapNodeOutput` — pose
 * rotation, then the `alphaFor` multiplier — exactly as the main canvas's
 * `buildSceneLayer` does, so a `drawOne` shared between the two paints the
 * same thing in both. A `drawOne` that rotates its own output will therefore
 * rotate twice here; emit unrotated geometry and let the pose drive it.
 *
 * Exported for tests and for callers that want to render into something
 * other than a real `<canvas>` (e.g. an offscreen renderer or a
 * snapshot fixture).
 */
export function buildSceneViewCommands<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  view: View,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
  extraCommands?: ReadonlyArray<DrawCommand>,
  alphaFor?: (id: string) => number,
): DrawCommand[] {
  const children: DrawCommand[] = [];
  for (const id of scene.renderOrder()) {
    const node = scene.get(id);
    if (!node) continue;
    const cmds = drawOne(node, node.pose, view);
    const wrapped = wrapNodeOutput(cmds, node.pose, alphaFor ? alphaFor(id) : 1);
    for (const cmd of wrapped) children.push(cmd);
  }
  if (extraCommands && extraCommands.length > 0) {
    for (const cmd of extraCommands) children.push(cmd);
  }
  return [{
    kind: 'group',
    transform: viewToMat3(view),
    children,
  }];
}

/**
 * Render one frame of `scene` at `view` into `canvas`. See module docstring
 * for the design context.
 *
 * Idempotent at the GL-context level: on first call a `WeaselRenderer` is
 * constructed against the canvas's WebGL2 context and cached in a
 * module-level WeakMap keyed by the canvas element. Subsequent calls reuse
 * that renderer. When `width` / `height` / `dpr` change between calls, the
 * renderer's `resize` is invoked (which also updates the canvas's `width` /
 * `height` attributes and CSS `style.width` / `style.height`).
 *
 * Returns `void`. If the underlying environment can't supply a WebGL2 context
 * (e.g. jsdom in tests), the call is a silent no-op — mirroring `<Canvas>`'s
 * `getContext` bail-out (`Canvas.tsx` line ~1445).
 */
export function renderSceneToCanvas<TData, TLayer extends string, TPose>(
  args: RenderSceneToCanvasArgs<TData, TLayer, TPose>,
): void {
  const { canvas, scene, view, width, height, drawOne, extraCommands, alphaFor } = args;
  const dpr = args.dpr
    ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  let entry = RENDERER_CACHE.get(canvas);
  if (!entry) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
    if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') {
      // jsdom / no-WebGL2 environment. Silent bail-out matches `<Canvas>`.
      return;
    }
    let renderer: WeaselRenderer;
    try {
      renderer = new WeaselRenderer({
        gl: gl as WebGL2RenderingContext,
        canvas,
        width,
        height,
        dpr,
      });
    } catch {
      // Same bail-out reasoning as <Canvas>: test env or context-creation failure.
      return;
    }
    entry = { renderer, width, height, dpr };
    RENDERER_CACHE.set(canvas, entry);
  } else if (entry.width !== width || entry.height !== height || entry.dpr !== dpr) {
    entry.renderer.resize({ width, height, dpr });
    entry.width = width;
    entry.height = height;
    entry.dpr = dpr;
  }

  const commands = buildSceneViewCommands(scene, view, drawOne, extraCommands, alphaFor);
  entry.renderer.render(commands, viewToMat3(view));
}
