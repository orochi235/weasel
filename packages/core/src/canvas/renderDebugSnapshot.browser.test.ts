/**
 * `renderDebugSnapshot` against real WebGL2: the scene and the debug overlay
 * land in one raster, lined up the way the canvas showed them.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { renderDebugSnapshot } from './renderDebugSnapshot';
import { rasterToPng } from './rasterToPng';
import { createDebugSink } from '../debug/createDebugSink';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RasterImage } from './renderSceneToPixels';

function px(img: RasterImage, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/** A red square at world (10, 10)–(20, 20), with bounds recorded around it. */
function fixture() {
  const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 10, height: 10 }, data: null });
  const sink = createDebugSink({ bounds: true });
  sink.recordBounds('a', { x: 10, y: 10, width: 10, height: 10 });
  const drawOne = (_n: unknown, p: RectPose): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { paint: { kind: 'solid', color: '#ff0000' } },
  }];
  return { scene, debug: sink.snapshot(), drawOne };
}

describe('renderDebugSnapshot', () => {
  it('rasterizes what the canvas showed: scene under the camera, overlay on top, at the pixel ratio', () => {
    const { scene, debug, drawOne } = fixture();
    const img = renderDebugSnapshot({
      scene, drawOne, debug,
      config: { bounds: true },
      view: { x: 5, y: 5, scale: { x: 2, y: 2 } },
      size: { width: 40, height: 30 },
      pixelRatio: 2,
      background: '#000000',
    });
    expect([img.width, img.height]).toEqual([80, 60]);
    // World (10, 10) is CSS (10, 10) through the camera, output (20, 20).
    // The square fills to output (60, 60); its inside is scene red…
    expect(px(img, 40, 40)).toEqual([255, 0, 0, 255]);
    // …and the bounds stroke sits on its edge in the overlay's yellow.
    const [r, g, b] = px(img, 20, 40);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeLessThan(100);
    // Outside both: the background.
    expect(px(img, 5, 5)).toEqual([0, 0, 0, 255]);
  });

  it('rasterizes a y-up view, with larger world y nearer the top', () => {
    const { scene, debug, drawOne } = fixture();
    const img = renderDebugSnapshot({
      scene, drawOne, debug,
      config: { bounds: true },
      // World y = 40 is the top row and y = 0 the bottom one.
      view: { x: 0, y: 40, scale: { x: 1, y: -1 } },
      size: { width: 40, height: 40 },
      pixelRatio: 2,
      background: '#000000',
    });
    expect([img.width, img.height]).toEqual([80, 80]);
    // The square spans world y 10–20: CSS rows 20–30, output rows 40–60.
    expect(px(img, 30, 50)).toEqual([255, 0, 0, 255]);
    expect(px(img, 30, 30)).toEqual([0, 0, 0, 255]);
    expect(px(img, 30, 70)).toEqual([0, 0, 0, 255]);
    const [r, g, b] = px(img, 20, 50);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeLessThan(100);
  });

  it('encodes a raster as a PNG', async () => {
    const { scene, debug, drawOne } = fixture();
    const img = renderDebugSnapshot({
      scene, drawOne, debug, config: { bounds: true },
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      size: { width: 32, height: 32 },
    });
    const blob = await rasterToPng(img);
    expect(blob.type).toBe('image/png');
    const decoded = await createImageBitmap(blob);
    expect([decoded.width, decoded.height]).toEqual([32, 32]);
  });
});
