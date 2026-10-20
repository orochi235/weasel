/**
 * The raster hook `writePdf` calls for what a PDF cannot draw: effects and shaders.
 */
import { createScene, mat3, warmRender, type RasterSession } from '@weasel-js/core';
import type { WritePdfOptions } from '@weasel-js/pdf';

/**
 * A hook that draws its commands through `session`, which are in page points. The renderer reads
 * `world`-unit paint through the session's view, so that view is the page view followed by the move
 * from page points to raster pixels, written as the source rect and scale the session plans it from.
 */
export function pageRasterizer(session: RasterSession): NonNullable<WritePdfOptions['rasterize']> {
  const empty = createScene({ systemLayers: [{ id: 'main' }] });
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
    });
  };
}
