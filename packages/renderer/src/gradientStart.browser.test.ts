/**
 * A gradient drawn by the path program starts where its paint says. The start
 * point is folded into `u_worldInv` on the CPU, so the shader measures from the
 * origin of what that matrix hands it; the recorder sees the matrix and never
 * where the ramp lands. Even-odd squares too costly to resolve, because that is
 * the fill that still draws through this program and not the batch.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';
import type { PolygonPath } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

const SIZE = 16;
const STOPS = [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }];

const SQUARE: PolygonPath = stencilledEvenOdd({
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, SIZE, 0, SIZE, SIZE, 0, SIZE]),
});

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** The red channel at each pixel, top-left origin. */
function paint(fill: unknown): (x: number, y: number) => number {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render([{ kind: 'path', path: SQUARE, fill: { paint: fill } } as DrawCommand]);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => px[((SIZE - 1 - y) * SIZE + x) * 4];
}

describe('a gradient through the path program, in a real context', () => {
  it('runs a linear gradient from its start point to its end', () => {
    const at = paint({ kind: 'linear-gradient', from: { x: 4, y: 0 }, to: { x: 12, y: 0 }, stops: STOPS });
    expect(at(1, 8)).toBe(0);
    expect(at(3, 8)).toBe(0);
    // Pixel 8's center is 4.5 of the 8 along.
    expect(Math.abs(at(8, 8) - 255 * (4.5 / 8))).toBeLessThanOrEqual(3);
    expect(at(13, 8)).toBe(255);
  });

  it('centers a radial gradient on its center', () => {
    const at = paint({ kind: 'radial-gradient', center: { x: 12, y: 4 }, radius: 4, stops: STOPS });
    // Half a pixel off the center on each axis, of a radius of 4.
    expect(at(12, 4)).toBeLessThanOrEqual(255 * (Math.SQRT1_2 / 4) + 3);
    expect(at(2, 12)).toBe(255);
    // Equal distances either side of the center read alike.
    expect(Math.abs(at(10, 4) - at(13, 4))).toBeLessThanOrEqual(2);
  });

  it('turns a conic gradient about its center', () => {
    const at = paint({ kind: 'conic-gradient', center: { x: 8, y: 8 }, angle: 0, stops: STOPS });
    // Just past the seam on one side and just short of it on the other.
    expect(at(14, 8)).toBeLessThan(40);
    expect(at(14, 7)).toBeGreaterThan(215);
  });
});
