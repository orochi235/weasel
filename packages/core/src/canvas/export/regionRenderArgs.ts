import type { RectPose } from 'core/geometry/rectPose';
import { documentOf } from 'core/scene/documentOf';
import type { RenderSceneToPixelsArgs } from '../renderSceneToPixelsTypes';
import type { ExportRegion, ExportScene } from './exportTypes';

/** What {@link regionRenderArgs} answers: the part of `renderSceneToPixels`'s arguments a region decides. */
export type RegionRenderArgs = Pick<RenderSceneToPixelsArgs<unknown, string, RectPose>, 'scene' | 'sourceRect' | 'scale' | 'background'>;

/** Options for {@link regionRenderArgs}. */
export interface RegionRenderArgsOptions {
  /** Output pixels per world unit. */
  scale: number;
  /** The color painted under the region. Default none: transparent. */
  background?: string | null;
}

/**
 * The arguments `region` of `scene` renders with: the scene's document (not
 * what an open gesture or edit is showing), the region as the source rect, and
 * `scale` on both axes. The PNG and PDF exports draw through these.
 *
 * Outside a browser, hand them to `@weasel-js/headless`'s raster host, whose
 * `NodeRenderArgs` they satisfy as they are, to render a page or any other
 * region from Node.
 */
export function regionRenderArgs(scene: ExportScene, region: ExportRegion, opts: RegionRenderArgsOptions): RegionRenderArgs {
  return {
    scene: documentOf(scene),
    sourceRect: { x: region.x, y: region.y, width: region.width, height: region.height },
    scale: { x: opts.scale, y: opts.scale },
    ...(opts.background != null ? { background: opts.background } : {}),
  };
}
