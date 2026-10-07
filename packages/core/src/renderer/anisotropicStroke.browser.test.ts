/**
 * A 1px `{ px }` stroke is one device pixel wide in every direction at a 4:1
 * view, read back from real WebGL2 — the claim the glRecorder tests make about
 * vertices, made about pixels.
 *
 * The mean-scale width this replaced painted these lines 0.5px tall running
 * across, 2px wide running down, and 0.56px across the shallow diagonal, so
 * every check below sits far from where the old ink landed.
 */
import { describe, it, expect } from 'vitest';
import type { Path } from '@weasel-js/core';
import { ellipsePath, linePath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import type { DrawCommand } from './DrawCommand';
import { renderSceneToPixels, type RasterImage } from '../canvas/renderSceneToPixels';

const SCALE = { x: 4, y: 1 };
const SOURCE = { x: 0, y: 0, width: 60, height: 240 };

/** World geometry, with where each lands on the 240×240 output in comments.
 *  The ellipse is four times as tall as it is wide, so it lands a circle. */
const SHAPES: Record<string, Path> = {
  across: linePath({ x: 5, y: 20 }, { x: 55, y: 20 }), // y 20, x 20–220
  down: linePath({ x: 30, y: 40 }, { x: 30, y: 90 }), // x 120, y 40–90
  diagonal: linePath({ x: 5, y: 100 }, { x: 45, y: 120 }), // (20,100)–(180,120)
  ellipse: ellipsePath({ x: 35, y: 140, width: 20, height: 80 }), // x 140–220, y 140–220
  rect: { kind: 'rect', x: 5, y: 160, width: 20, height: 30 }, // x 20–100, y 160–190
};

function render(dash?: number[]): RasterImage {
  const scene = createScene<{ cmd: DrawCommand }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const path of Object.values(SHAPES)) {
    scene.add({
      kind: 'leaf', layer: 'main',
      pose: { ...SOURCE },
      data: {
        cmd: {
          kind: 'path', path,
          stroke: { paint: { color: '#ffffff' }, width: { px: 1 }, cap: 'butt', ...(dash ? { dash } : {}) },
        },
      },
    });
  }
  return renderSceneToPixels({
    scene, sourceRect: SOURCE, scale: SCALE, background: '#000000',
    drawOne: (node) => [node.data.cmd],
  });
}

const ink = (img: RasterImage, x: number, y: number) => img.data[(y * img.width + x) * 4] / 255;

/** Ink summed across a line's crossing: down each column in `cols` over
 *  `rows`, or along each row in `rows` over `cols`. */
function crossings(img: RasterImage, along: 'column' | 'row', cols: [number, number], rows: [number, number]): number[] {
  const out: number[] = [];
  const [outer, inner] = along === 'column' ? [cols, rows] : [rows, cols];
  for (let i = outer[0]; i < outer[1]; i++) {
    let sum = 0;
    for (let j = inner[0]; j < inner[1]; j++) sum += along === 'column' ? ink(img, i, j) : ink(img, j, i);
    out.push(sum);
  }
  return out;
}

/** Median ink of the crossings that hit ink at all — every crossing of a
 *  solid line, the dashes of a dashed one — and the share that did. The
 *  median, because a crossing through a dash's slanted end is fractional. */
function inkedMedian(sums: number[]): { median: number; inked: number } {
  const hit = sums.filter((s) => s > 0.3).sort((a, b) => a - b);
  return { median: hit[hit.length >> 1] ?? 0, inked: hit.length / sums.length };
}

/** Each crossing to measure: which way it runs, its window, and the ink one
 *  crossing of a 1px line carries there — more than 1 on the diagonal, where
 *  a column cuts the line at a slant. */
const CHECKS: { name: string; along: 'column' | 'row'; cols: [number, number]; rows: [number, number]; expected: number }[] = [
  { name: 'line across', along: 'column', cols: [30, 210], rows: [10, 30], expected: 1 },
  { name: 'line down', along: 'row', cols: [110, 130], rows: [45, 85], expected: 1 },
  { name: 'diagonal', along: 'column', cols: [30, 170], rows: [95, 126], expected: Math.hypot(160, 20) / 160 },
  { name: 'ellipse top', along: 'column', cols: [170, 190], rows: [132, 160], expected: 1 },
  { name: 'ellipse side', along: 'row', cols: [132, 165], rows: [170, 190], expected: 1 },
  { name: 'rect top', along: 'column', cols: [30, 90], rows: [150, 170], expected: 1 },
  { name: 'rect side', along: 'row', cols: [10, 30], rows: [165, 185], expected: 1 },
];

describe('a 1px stroke at a 4:1 view', () => {
  it.each(CHECKS)('is one pixel wide: $name', ({ along, cols, rows, expected }) => {
    const { median, inked } = inkedMedian(crossings(render(), along, cols, rows));
    expect(inked).toBe(1);
    expect(median).toBeCloseTo(expected, 1);
  });

  it.each(CHECKS)('is one pixel wide dashed: $name', ({ along, cols, rows, expected }) => {
    const { median, inked } = inkedMedian(crossings(render([6, 4]), along, cols, rows));
    expect(inked).toBeGreaterThan(0.3);
    expect(inked).toBeLessThan(0.9);
    expect(median).toBeCloseTo(expected, 1);
  });

  it('dashes in screen pixels whichever way the line runs', () => {
    const img = render([6, 4]);
    const runs = (sums: number[]) => {
      const lengths: number[] = [];
      let run = 0;
      for (const s of sums) {
        if (s > 0.5) run++;
        else if (run > 0) { lengths.push(run); run = 0; }
      }
      return lengths;
    };
    for (const n of runs(crossings(img, 'column', [20, 220], [10, 30]))) expect(Math.abs(n - 6)).toBeLessThanOrEqual(1);
    for (const n of runs(crossings(img, 'row', [110, 130], [40, 90]))) expect(Math.abs(n - 6)).toBeLessThanOrEqual(1);
  });
});
