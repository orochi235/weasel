import {
  createRasterSession, idMask, renderSceneToPixels, scenePickIds, warmRender,
  type RectPose, type RenderSceneToPixelsArgs, type Scene,
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

/** The page at the grid's resolution, one pixel per dot. */
function pageArgs(scene: DitherScene, grid: OutputGrid): RenderArgs {
  const scale = 1 / grid.pitch;
  return {
    scene,
    sourceRect: { x: grid.origin.x, y: grid.origin.y, width: PAGE.width, height: PAGE.height },
    scale: { x: scale, y: scale },
    background: '#ffffff',
  };
}

/**
 * The dots to keep at plain threshold, one byte per dot: every dot a mark
 * paints, read from an id frame of the marks layer, and each mark's
 * `protectedRect` beyond it, which holds the quiet zone a barcode leaves blank.
 */
export async function marksMask(scene: DitherScene, grid: OutputGrid): Promise<{ mask: Uint8Array; width: number; height: number }> {
  const args: RenderArgs = { ...pageArgs(scene, grid), layers: ['scene:marks'] };
  await warmRender({ render: args });
  const session = createRasterSession();
  let ids;
  try {
    ids = session.renderIds(args);
  } finally {
    session.dispose();
  }
  const { width, height } = ids;
  const pickIds = scenePickIds(scene);
  const marks = [...scene.nodes.values()].filter((n) => n.layer === 'marks') as DitherNode[];
  const mask = idMask(ids, new Set(marks.map((n) => pickIds.idOf(n.id))));
  const zones = protectMask(protectRects(marks, protectedRect, grid), width, height);
  for (let i = 0; i < mask.length; i++) mask[i] = mask[i]! | zones[i]!;
  return { mask, width, height };
}

async function rendered(args: RenderArgs) {
  await warmRender({ render: args });
  return renderSceneToPixels(args);
}

/** The page as the export prints it: rendered at the grid's resolution,
 *  dithered on the CPU, and painted black on white. */
export async function exportPage(scene: DitherScene, s: ExportSettings): Promise<ExportImage> {
  const base = pageArgs(scene, s.grid);
  let mask: Uint8Array;
  let width: number;
  let height: number;
  if (s.crisp === 'layer') {
    const art = await rendered({ ...base, layers: ['scene:art'] });
    const marks = await rendered({ ...base, layers: ['scene:marks'] });
    ({ width, height } = art);
    mask = ditherPixels(art, { method: s.method, threshold: s.threshold });
    const crisp = ditherPixels(marks, { method: 'threshold', threshold: s.threshold });
    for (let i = 0; i < mask.length; i++) mask[i] = mask[i]! | crisp[i]!;
  } else {
    const page = await rendered(base);
    ({ width, height } = page);
    const protect = s.crisp === 'mask' ? (await marksMask(scene, s.grid)).mask : undefined;
    mask = ditherPixels(page, { method: s.method, threshold: s.threshold, protect });
  }
  return { width, height, data: maskToRgba(mask, width, height, { blank: WHITE }) };
}
