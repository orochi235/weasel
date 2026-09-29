/**
 * One raster session, two different scenes and sizes, in real WebGL2: each
 * render has to come back with its own pixels, not the previous render's
 * leftovers in a buffer the session reuses.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { createRasterSession, type RasterImage } from './renderSceneToPixels';
import type { DrawCommand } from '../renderer/DrawCommand';

interface Box { color: string }

const drawOne = (node: { data: Box }, p: RectPose): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
  fill: { fill: 'solid', color: node.data.color },
} as DrawCommand];

function sceneOf(boxes: Array<RectPose & Box>) {
  const scene = createScene<Box, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const { color, ...pose } of boxes) scene.add({ kind: 'leaf', layer: 'main', pose, data: { color } });
  return scene;
}

function pixel(img: RasterImage, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4;
  return Array.from(img.data.subarray(i, i + 4));
}

describe('raster session in a real browser', () => {
  it('renders two different scenes through one session, each with its own pixels', () => {
    // Red on the left half of a 40×20 page.
    const left = sceneOf([{ x: 0, y: 0, width: 20, height: 20, color: '#ff0000' }]);
    // Blue across the bottom of a taller 30×50 page, larger than the first
    // render, so the session's canvas has to grow.
    const bottom = sceneOf([{ x: 0, y: 25, width: 30, height: 25, color: '#0000ff' }]);

    const session = createRasterSession();
    try {
      const a = session.render({
        scene: left, drawOne: drawOne as never, background: '#ffffff',
        sourceRect: { x: 0, y: 0, width: 40, height: 20 }, scale: { x: 1, y: 1 },
      });
      const b = session.render({
        scene: bottom, drawOne: drawOne as never, background: '#ffffff',
        sourceRect: { x: 0, y: 0, width: 30, height: 50 }, scale: { x: 1, y: 1 },
      });
      const again = session.render({
        scene: left, drawOne: drawOne as never, background: '#ffffff',
        sourceRect: { x: 0, y: 0, width: 40, height: 20 }, scale: { x: 1, y: 1 },
      });

      expect([a.width, a.height]).toEqual([40, 20]);
      expect(pixel(a, 5, 10)).toEqual([255, 0, 0, 255]);
      expect(pixel(a, 35, 10)).toEqual([255, 255, 255, 255]);

      expect([b.width, b.height]).toEqual([30, 50]);
      expect(pixel(b, 15, 10)).toEqual([255, 255, 255, 255]);
      expect(pixel(b, 15, 40)).toEqual([0, 0, 255, 255]);
      // Where the first render put red, the second has none.
      expect(pixel(b, 5, 5)).toEqual([255, 255, 255, 255]);

      // Back to the smaller page on the grown canvas: the same bytes as the
      // first time.
      expect(Array.from(again.data)).toEqual(Array.from(a.data));
    } finally {
      session.dispose();
    }
  });
});
