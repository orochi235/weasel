import { sceneFromJSON, type RasterRenderArgs, type RectPose, type SavedScene, type SceneFromJSONOptions } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { readPageRequest, sceneFromWire, type PageRequest } from './protocol';

/** What the page reads every request's scene back with. The page draws through the 2D raster path, so its
 *  scenes' poses are `RectPose`s. */
export type PageSceneOptions = SceneFromJSONOptions<unknown, string, RectPose>;

/** `sent`'s render, its scene read back with `options`. Throws when the scene does not read back
 *  here, naming what the page would need. */
export function pageRenderArgs(
  sent: PageRequest,
  options: PageSceneOptions,
): { args: RasterRenderArgs<unknown, string, RectPose>; format: PageRequest['format'] } {
  const { scene, screen, format, overlay, ...rest } = readPageRequest(sent);
  let read;
  try {
    read = sceneFromJSON(sceneFromWire(scene) as SavedScene<unknown, string, RectPose>, options);
  } catch (err) {
    throw new Error(
      `headless page: the scene does not read back in this page (${(err as Error).message}). `
      + 'A scene\'s registry, composition, layoutFrame and quantize rule are the page\'s to give: '
      + 'serve it from a page script with `serveHeadlessPage({ scene })`.',
      { cause: err },
    );
  }
  const args: RasterRenderArgs<unknown, string, RectPose> = {
    ...rest,
    scene: read,
    ...(overlay ? { overlay: overlay as readonly DrawCommand[] } : {}),
    ...(screen ? { screen: Float64Array.from(screen) } : {}),
  };
  return { args, format };
}
