import {
  defaultDrawOne, renderSceneToPixels, warmRender,
  type RectPose, type RenderSceneToPixelsArgs, type Scene, type SceneViewDrawOne,
} from '@weasel-js/core';
import { ditherPixels, maskToRgba, protectMask, protectRects, type DitherMethod } from '@weasel-js/dither';
import type { OutputGrid } from '@weasel-js/geom';
import { PAGE, protectedRect, type DitherLayer, type DitherNode, type DitherNodeData } from './ditherDemoScene';

export type Crisp = 'layer' | 'mask' | 'off';

export interface ExportSettings {
  /** One pixel per dot; the screen grid exports at one pixel per point. */
  grid: OutputGrid;
  method: DitherMethod;
  threshold: number;
  crisp: Crisp;
}

export interface ExportImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

type DitherScene = Scene<DitherNodeData, DitherLayer, RectPose>;
type RenderArgs = RenderSceneToPixelsArgs<DitherNodeData, DitherLayer, RectPose>;

const WHITE = [255, 255, 255, 255] as const;

/** `renderSceneToPixels` takes no layer filter, so one layer is drawn by
 *  leaving the other's nodes out of `drawOne`. */
const onLayer = (layer: DitherLayer): SceneViewDrawOne<DitherNodeData, DitherLayer, RectPose> =>
  (node, pose, view, ctx) => (node.layer === layer ? defaultDrawOne(node, pose, view, ctx) : []);

async function rendered(args: RenderArgs) {
  await warmRender({ render: args });
  return renderSceneToPixels(args);
}

/** The page as the export prints it: rendered at the grid's resolution,
 *  dithered on the CPU, and painted black on white. */
export async function exportPage(scene: DitherScene, s: ExportSettings): Promise<ExportImage> {
  const scale = 1 / s.grid.pitch;
  const base: RenderArgs = {
    scene,
    sourceRect: { x: 0, y: 0, width: PAGE.width, height: PAGE.height },
    scale: { x: scale, y: scale },
    background: '#ffffff',
  };
  let mask: Uint8Array;
  let width: number;
  let height: number;
  if (s.crisp === 'layer') {
    const art = await rendered({ ...base, drawOne: onLayer('art') });
    const marks = await rendered({ ...base, drawOne: onLayer('marks') });
    ({ width, height } = art);
    mask = ditherPixels(art, { method: s.method, threshold: s.threshold });
    const crisp = ditherPixels(marks, { method: 'threshold', threshold: s.threshold });
    for (let i = 0; i < mask.length; i++) mask[i] = mask[i]! | crisp[i]!;
  } else {
    const page = await rendered(base);
    ({ width, height } = page);
    const marks = [...scene.nodes.values()].filter((n) => n.layer === 'marks') as DitherNode[];
    const protect = s.crisp === 'mask'
      ? protectMask(protectRects(marks, protectedRect, s.grid), width, height)
      : undefined;
    mask = ditherPixels(page, { method: s.method, threshold: s.threshold, protect });
  }
  return { width, height, data: maskToRgba(mask, width, height, { blank: WHITE }) };
}
