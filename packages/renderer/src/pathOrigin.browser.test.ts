/**
 * A path far from the world origin lands where its origin says, in a real
 * context. At world x = 262,144 and 64x a float32 coordinate is on a 2 px grid:
 * the left edge here, 0.3 past the far point, would round to 0.3125 and draw
 * 0.8 px right of where it belongs, leaving pixel 10 empty. Measured from an
 * origin beside it, the edge sits on pixel 10's left side.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PathBuilder, viewToMat3, type PolygonPath } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const WORLD_X = 262_144;
const ZOOM = 64;
const LEFT = 0.3;
const W = 32;
const H = 16;
/** Puts world x `WORLD_X + LEFT` at screen x 10. */
const VIEW = viewToMat3({ x: WORLD_X + LEFT - 10 / ZOOM, y: 0, scale: { x: ZOOM, y: ZOOM } });

/** 12.8 px wide from screen x 10, taller than the canvas. */
function bar(fillRule: 'nonzero' | 'evenodd', origin: boolean): PolygonPath {
  const b = new PathBuilder().setFillRule(fillRule);
  if (origin) b.setOrigin(WORLD_X, 0);
  return b.moveTo(WORLD_X + LEFT, 0).lineTo(WORLD_X + LEFT + 0.2, 0)
    .lineTo(WORLD_X + LEFT + 0.2, 1).lineTo(WORLD_X + LEFT, 1).close().build();
}

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** Red at each column of the middle row. */
function row(cmd: DrawCommand): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, antialias: false })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderer.render([{ kind: 'group', transform: VIEW, children: [cmd] }], VIEW);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from({ length: W }, (_, x) => px[((H / 2) * W + x) * 4]);
}

const fill = (path: PolygonPath): DrawCommand => ({ kind: 'path', path, fill: { paint: { kind: 'solid', color: '#f00' } } });
const stroke = (path: PolygonPath): DrawCommand => ({
  kind: 'path', path, stroke: { paint: { kind: 'solid', color: '#f00' }, width: 0.05, align: 'inner' },
});

describe('a path with an origin far from the world origin, in a real context', () => {
  it('leaves pixel 10 empty without one, which is what the rest of this file guards', () => {
    const red = row(fill(bar('nonzero', false)));
    expect(red[10]).toBe(0);
    expect(red[11]).toBe(255);
  });

  it('starts a batched fill on pixel 10', () => {
    const red = row(fill(bar('nonzero', true)));
    expect(red[9]).toBe(0);
    expect(red[10]).toBe(255);
    expect(red[22]).toBe(255);
    expect(red[23]).toBe(0);
  });

  it('starts an even-odd fill, drawn by its own call, on pixel 10', () => {
    const red = row(fill(bar('evenodd', true)));
    expect(red[9]).toBe(0);
    expect(red[10]).toBe(255);
    expect(red[22]).toBe(255);
    expect(red[23]).toBe(0);
  });

  it('cuts an inner stroke to the fill it lines, both from the origin', () => {
    // 3.2 px inside each side edge.
    const red = row(stroke(bar('nonzero', true)));
    expect(red[9]).toBe(0);
    expect(red[10]).toBe(255);
    expect(red[12]).toBe(255);
    expect(red[14]).toBe(0);
    expect(red[22]).toBe(255);
    expect(red[23]).toBe(0);
  });
});
