/**
 * A stroke on synthetic-bold text, against real WebGL2 and Inter's real
 * outlines: the outline tier strokes the grown outline, which must trace only
 * the glyph's edge. A stroke pixel deep inside the fill is a contour the grown
 * outline left inside the glyph.
 *
 * Inter's atlas is registered at 400 only, so 700 is faked from it and grown.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerFont, registerFontOutlines, loadFontOutlines, outlineStatus } from '@weasel-js/font';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { createRasterSession, type RasterImage } from './renderSceneToPixels';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';

const FAMILY = 'synthetic-bold-stroke-inter';
const SIZE = 600;
const TEXT = 'bdk1';
const POSE: RectPose = { x: 20, y: 0, width: 1500, height: SIZE * 1.2 };
const SOURCE = { x: 0, y: 0, width: 1540, height: SIZE * 1.2 };
/** How far inside the fill a pixel must sit, every pixel this near it filled,
 *  before stroke ink on it counts as stray. The edge's own stroke reaches 1px
 *  in, and its antialiasing one more. */
const DEPTH_PX = 3;

const session = createRasterSession();
afterAll(() => session.dispose());

function render(fontWeight: number, paint: 'fill' | 'stroke'): RasterImage {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'leaf',
    layer: 'main',
    pose: { ...POSE },
    data: {
      text: TEXT,
      style: { fontFamily: FAMILY, fontSize: SIZE, fontWeight, lineHeight: 1.2 },
      ...(paint === 'fill'
        ? { fill: { paint: { kind: 'solid', color: '#ffffff' } } }
        : { fill: null, stroke: { paint: { kind: 'solid', color: '#ff0000' }, width: 2 } }),
    },
  });
  return session.render({ scene, sourceRect: SOURCE, scale: { x: 1, y: 1 }, background: '#000000' });
}

const red = (img: RasterImage, x: number, y: number) => img.data[(y * img.width + x) * 4] / 255;

/** Stroke pixels lying `DEPTH_PX` deep in the fill, and how many stroke pixels
 *  there are in all. */
function strayInk(fill: RasterImage, stroke: RasterImage): { stray: [number, number][]; ink: number } {
  const { width, height } = fill;
  const stray: [number, number][] = [];
  let ink = 0;
  const deep = (x: number, y: number) => {
    for (let j = -DEPTH_PX; j <= DEPTH_PX; j++) {
      for (let i = -DEPTH_PX; i <= DEPTH_PX; i++) {
        const xi = x + i,
          yj = y + j;
        if (xi < 0 || yj < 0 || xi >= width || yj >= height || red(fill, xi, yj) < 0.99) return false;
      }
    }
    return true;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (red(stroke, x, y) < 0.25) continue;
      ink++;
      if (deep(x, y)) stray.push([x, y]);
    }
  }
  return { stray, ink };
}

beforeAll(async () => {
  await registerFont(FAMILY, { weight: 400 }, metricsUrl, atlasUrl);
  registerFontOutlines(FAMILY, { weight: 400 }, ttfUrl);
  await loadFontOutlines(FAMILY, { weight: 400 });
  expect(outlineStatus(FAMILY, 400, 'normal')).toBe('ready');
});

describe('a stroke on synthetic-bold text', () => {
  it.each([400, 700])('traces only the edge of the glyphs at weight %i', (weight) => {
    const { stray, ink } = strayInk(render(weight, 'fill'), render(weight, 'stroke'));
    expect(ink, 'the stroke is drawn').toBeGreaterThan(2000);
    expect(stray.length, `stray stroke pixels, first at ${JSON.stringify(stray.slice(0, 5))}`).toBe(0);
  });
});
