/**
 * Draw commands to pixels through a `RasterSession`: the hook a file writer calls for what its
 * format cannot express, and gets back an image to place instead.
 */
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from '../core/scene/scene';
import type { RasterImage } from './renderSceneToPixelsTypes';
import type { RasterSession } from './renderSceneToPixels';
import { warmRender } from './renderSceneToPixels';

/** An axis-aligned rectangle in page units. */
export interface RasterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws `commands`, which are in a page's frame, in order onto a clear raster of `rect` at `scale`
 * pixels per page unit. `view` is the page's view: what a `world`-unit paint in `commands` resolves
 * through.
 */
export type CommandRasterizer = (
  commands: readonly DrawCommand[],
  rect: RasterRect,
  scale: number,
  view: GlMat3 | undefined,
) => Promise<RasterImage>;

/**
 * A {@link CommandRasterizer} drawing through `session`. The renderer reads `world`-unit paint
 * through the session's view, so that view is the page view followed by the move from page units to
 * raster pixels, written as the source rect and scale the session plans it from. `screen`-unit paint
 * is in page units too, so the session's screen space is the page.
 */
export function commandRasterizer(session: RasterSession): CommandRasterizer {
  const empty = createScene<unknown, 'main'>({ systemLayers: [{ id: 'main' }] });
  return async (commands, rect, scale, view) => {
    await warmRender({ commands });
    const toPixels = mat3.translated(mat3.scaled(mat3.identity(), scale, scale), -rect.x, -rect.y);
    const toRaster = view ? mat3.multiply(Float64Array.from(toPixels), view) : toPixels;
    const sx = toRaster[0]!;
    const sy = toRaster[4]!;
    return session.render({
      scene: empty,
      sourceRect: { x: -toRaster[6]! / sx, y: -toRaster[7]! / sy, width: (rect.width * scale) / sx, height: (rect.height * scale) / sy },
      scale: { x: sx, y: sy },
      overlay: [{ kind: 'group', transform: toPixels, children: [...commands] }],
      screen: toPixels,
    });
  };
}
