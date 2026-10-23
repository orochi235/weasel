/**
 * An embedded SVG stays sharp when zoomed: `kit:image` asks the cache for a
 * raster at the size it is drawn, so an 8×8 SVG drawn across 256 device pixels
 * has a hard edge, not eight texels stretched and filtered. jsdom rasterizes
 * nothing, so only a browser can read the edge.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { viewToMat3 } from '@weasel-js/geom';
import {
  WeaselRenderer, getImageBitmap, releaseImage, subscribeImageReady, type DrawCommand,
} from '@weasel-js/renderer';
import type { Node, RectPose } from 'core/scene/types';
import { IMAGE_PAINTER } from './imagePainter';

const NATURAL = 8;
const ZOOM = 32;
const SIZE = NATURAL * ZOOM;

/** Black left half, white right half: one vertical edge down the middle. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${NATURAL}" height="${NATURAL}">`
  + `<rect width="${NATURAL / 2}" height="${NATURAL}" fill="#000"/>`
  + `<rect x="${NATURAL / 2}" width="${NATURAL / 2}" height="${NATURAL}" fill="#fff"/></svg>`;
const SRC = `data:image/svg+xml;utf8,${encodeURIComponent(SVG)}`;

const POSE: RectPose = { x: 0, y: 0, width: NATURAL, height: NATURAL };
const NODE = { id: 'n', kind: 'mark', layer: 'main', parent: null, pose: POSE, data: { image: { src: SRC } } } as
  unknown as Node<unknown, string, RectPose>;

let renderer: WeaselRenderer | undefined;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  releaseImage(SRC);
});

/** Wait for the cache to settle on a raster at least `width` wide. */
async function rasterOf(width: number, ask: () => void): Promise<ImageBitmap> {
  const deadline = performance.now() + 5000;
  for (;;) {
    ask();
    const bmp = getImageBitmap(SRC);
    if (bmp && bmp.width >= width) return bmp;
    if (performance.now() > deadline) throw new Error(`no ${width}px raster; have ${bmp?.width ?? 'none'}`);
    await new Promise<void>((resolve) => {
      const off = subscribeImageReady(() => { off(); resolve(); });
      setTimeout(() => { off(); resolve(); }, 100);
    });
  }
}

/** Render `commands` under the zoom and count the pixels of the middle row
 *  that are neither black nor white: the width of the edge. */
function edgeWidth(commands: DrawCommand[]): number {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render([{ kind: 'group', transform: viewToMat3({ x: 0, y: 0, scale: { x: ZOOM, y: ZOOM } }), children: commands }]);
  const row = new Uint8Array(SIZE * 4);
  gl.readPixels(0, SIZE / 2, SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
  expect(row[0], 'left end is black').toBeLessThan(16);
  expect(row[(SIZE - 1) * 4], 'right end is white').toBeGreaterThan(239);
  let soft = 0;
  for (let x = 0; x < SIZE; x++) if (row[x * 4] >= 16 && row[x * 4] <= 239) soft++;
  return soft;
}

describe('an embedded SVG drawn far above its natural size', () => {
  it('is re-rasterized at the drawn size, so its edge is at most two pixels wide', async () => {
    const paint = (): DrawCommand[] => IMAGE_PAINTER.paint(NODE, POSE, { pixelScale: ZOOM });
    const bmp = await rasterOf(SIZE, paint);
    expect(bmp.width).toBe(SIZE);
    expect(edgeWidth(paint())).toBeLessThanOrEqual(2);
  });

  // The control: the same measure on the natural-size raster, which is what
  // the node would draw if nothing re-rasterized it.
  it('would smear that edge across a texel if the natural-size raster were stretched', async () => {
    const natural = await rasterOf(NATURAL, () => {});
    expect(natural.width).toBe(NATURAL);
    const stretched: DrawCommand[] = [{ kind: 'image', image: natural, x: 0, y: 0, w: NATURAL, h: NATURAL }];
    expect(edgeWidth(stretched)).toBeGreaterThan(ZOOM / 2);
  });
});
