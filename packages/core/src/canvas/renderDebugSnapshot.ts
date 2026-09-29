/**
 * `renderDebugSnapshot` — the canvas as its debug overlay showed it, scene and
 * overlay in one raster, for attaching to a bug report.
 */
import { renderSceneToPixels, type RasterImage, type RenderSceneToPixelsArgs } from './renderSceneToPixels';
import { buildDebugOverlayCommands } from '../debug/createDebugOverlayLayer';
import type { DebugConfig, DebugSnapshot } from '../debug/types';
import type { View } from '../core/viewport/view';
import { mat3 } from '../renderer/math/mat3';

/** The canvas to reproduce — its camera, its size, and what its debug overlay
 *  had recorded — plus how to rasterize the scene under it. */
export interface RenderDebugSnapshotArgs<TData, TLayer extends string, TPose>
  extends Omit<RenderSceneToPixelsArgs<TData, TLayer, TPose>, 'sourceRect' | 'scale' | 'overlay'> {
  /** The camera the canvas was looking through. */
  view: View;
  /** The canvas's size in CSS pixels. */
  size: { width: number; height: number };
  /** Output pixels per CSS pixel. Default 1; pass `devicePixelRatio` for what
   *  the screen showed. */
  pixelRatio?: number;
  /** What the overlay draws — a canvas's `getDebug()?.snapshot()`. */
  debug: DebugSnapshot;
  /** Which overlay features to draw, as on `<Canvas debug>`. The frame panel
   *  shows the recorded paint cost but no rate: a still image has no frames. */
  config: DebugConfig;
}

/**
 * Rasterize the scene through `view` at `size` and paint the debug overlay
 * over it, the way the canvas composed them. Built on `renderSceneToPixels`,
 * so the scene pixels are the screen's pixels at that resolution, and
 * synchronous like it: `await warmRender()` first. Encode the result with
 * `rasterToPng` to attach it somewhere.
 */
export function renderDebugSnapshot<TData, TLayer extends string, TPose>(
  args: RenderDebugSnapshotArgs<TData, TLayer, TPose>,
): RasterImage {
  const { view, size, debug, config, pixelRatio = 1, ...rest } = args;
  const overlay = buildDebugOverlayCommands(debug, config, view, size);
  return renderSceneToPixels({
    ...rest,
    sourceRect: { x: view.x, y: view.y, width: size.width / view.scale.x, height: size.height / view.scale.y },
    scale: { x: view.scale.x * pixelRatio, y: view.scale.y * pixelRatio },
    overlay: pixelRatio === 1
      ? overlay
      : [{ kind: 'group', transform: mat3.scaled(mat3.identity(), pixelRatio, pixelRatio), children: overlay }],
  });
}
