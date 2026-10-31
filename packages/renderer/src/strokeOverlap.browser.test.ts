/**
 * A translucent stroke blends once wherever it covers, inside its turns
 * included, as Canvas2D's does. The ribbon's segments meet at a turn, and a
 * call-sequence test cannot see whether their triangles cover the inside of
 * it twice; only the blended pixels say.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';

const W = 160;
const H = 160;

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** The alpha at each of `at`, top-left origin, with `d` stroked 10 wide in half-transparent red. */
function weasel(d: string, join: 'miter' | 'bevel' | 'round', at: [number, number][]): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true, antialias: false })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderer.render([{ kind: 'path', path: pathFromD(d), stroke: { width: 10, join, paint: { color: 'rgba(255, 0, 0, 0.5)' } } }]);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  renderer.dispose();
  renderer = undefined;
  return at.map(([x, y]) => px[((H - 1 - y) * W + x) * 4 + 3]);
}

function canvas2d(d: string, join: 'miter' | 'bevel' | 'round', at: [number, number][]): number[] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.canvas.width = W;
  ctx.canvas.height = H;
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 10;
  ctx.lineJoin = join;
  ctx.miterLimit = 4;
  ctx.stroke(new Path2D(d));
  const data = ctx.getImageData(0, 0, W, H).data;
  return at.map(([x, y]) => data[(y * W + x) * 4 + 3]);
}

/** Each shape with pixels inside a turn, where the segments meeting there would overlap. */
const SHAPES: [string, string, [number, number][]][] = [
  ['a closed square', 'M 20 20 L 120 20 L 120 120 L 20 120 Z', [[22, 22], [118, 22], [118, 118], [22, 118]]],
  ['an open zigzag', 'M 20 20 L 80 50 L 20 80 L 80 110', [[76, 50], [24, 80]]],
  ['a circle', 'M 130 80 C 130 108 108 130 80 130 C 52 130 30 108 30 80 C 30 52 52 30 80 30 C 108 30 130 52 130 80 Z',
    [[80, 33], [127, 80], [80, 127], [33, 80], [113, 47]]],
];

describe('a translucent stroke, in a real context', () => {
  for (const join of ['miter', 'bevel', 'round'] as const) {
    for (const [name, d, at] of SHAPES) {
      it(`blends once inside its turns, as Canvas2D does: ${join}, ${name}`, () => {
        const ours = weasel(d, join, at);
        const theirs = canvas2d(d, join, at);
        // The reference really is inside the stroke at every probe.
        expect(theirs.every((a) => a > 100 && a < 160)).toBe(true);
        for (let i = 0; i < at.length; i++) expect(Math.abs(ours[i] - theirs[i]), `at ${at[i]}`).toBeLessThanOrEqual(2);
      });
    }
  }
});
