/**
 * A fill or a stroke with per-vertex colors rides the batch: its colors go
 * into the vertices a solid's single color would, and the rasterizer
 * interpolates them as the vertex-color program's varying did. Against real
 * WebGL2 it has to share one draw with the solids around it and paint the
 * colors that program painted, under group alpha and a color matrix too.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const W = 16;
const H = 4;

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** `drawElements` calls the last `paint` made. */
let draws = 0;

function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, antialias: false })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  draws = 0;
  const drawElements = gl.drawElements.bind(gl);
  gl.drawElements = (...args: Parameters<typeof drawElements>): void => {
    draws++;
    drawElements(...args);
  };
  renderer.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => {
    const i = ((H - 1 - y) * W + x) * 4;
    return Array.from(px.slice(i, i + 4));
  };
}

const RED = [1, 0, 0, 1];
const BLUE = [0, 0, 1, 1];

/**
 * A rect from `x0` to `x1` whose left corners are `left` and right corners
 * `right`, so its color is linear in x whatever the triangulation, and a
 * pixel's is the mix at its center.
 */
function vcolorRect(x0: number, x1: number, left = RED, right = BLUE): DrawCommand {
  // Anchors run (x0,0), (x1,0), (x1,H), (x0,H).
  return {
    kind: 'path',
    path: { kind: 'rect', x: x0, y: 0, width: x1 - x0, height: H },
    fill: { paint: { kind: 'solid', color: '#ffffff' } },
    vertexColors: [...left, ...right, ...right, ...left],
  } as DrawCommand;
}

const solid = (x: number, w: number, color = '#00ff00'): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: w, height: H },
  fill: { paint: { color } },
});

/** The rgb `vcolorRect(x0, x1)` paints at pixel column `x`, out of 255. */
function mixAt(x: number, x0: number, x1: number, left = RED, right = BLUE): number[] {
  const t = (x + 0.5 - x0) / (x1 - x0);
  return [0, 1, 2].map((k) => (left[k] + (right[k] - left[k]) * t) * 255);
}

function expectNear(got: number[], want: number[], tol = 2): void {
  for (let k = 0; k < want.length; k++) expect(Math.abs(got[k] - want[k])).toBeLessThanOrEqual(tol);
}

describe('per-vertex colors in the batch, in a real context', () => {
  it('shares one draw with the solids either side and paints the interpolated colors', () => {
    const at = paint([solid(0, 4), vcolorRect(4, 12), solid(12, 4, '#ffff00')]);
    expect(draws).toBe(1);
    expectNear(at(1, 2), [0, 255, 0, 255]);
    for (const x of [4, 7, 11]) expectNear(at(x, 2), [...mixAt(x, 4, 12), 255]);
    expectNear(at(14, 2), [255, 255, 0, 255]);
  });

  it('shows through where a solid staged after it does not cover it', () => {
    // The trap in docs/traps/rendering.md: probe the pixel the covering
    // command leaves alone, not only the one it paints.
    const at = paint([vcolorRect(0, 16), solid(0, 8)]);
    expect(draws).toBe(1);
    expectNear(at(3, 2), [0, 255, 0, 255]);
    for (const x of [9, 12, 15]) expectNear(at(x, 2), [...mixAt(x, 0, 16), 255]);
  });

  it('multiplies the colors by the fill color, and the group alpha into them', () => {
    const fill = vcolorRect(0, 16, [1, 1, 1, 1], [0, 0, 0, 1]);
    (fill as { fill: { paint: { color: string } } }).fill.paint.color = '#ff8000';
    const at = paint([{ kind: 'group', alpha: 0.5, children: [fill] }]);
    for (const x of [2, 8, 13]) {
      const t = 1 - (x + 0.5) / 16;
      // Premultiplied over a cleared (0,0,0,0) target, read back as is.
      expectNear(at(x, 2), [255 * t * 0.5, 128 * t * 0.5, 0, 127.5]);
    }
  });

  it('maps the colors by a group color matrix per fragment, clamp included', () => {
    // Doubles red, so the clamp lands inside the rect: a per-vertex fold would
    // interpolate the clamped corners instead and miss the knee.
    const matrix = [
      2, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ];
    const at = paint([
      solid(0, 0.0001),
      { kind: 'group', colorMatrix: matrix, children: [vcolorRect(0, 16)] },
    ]);
    expect(draws).toBe(1);
    for (const x of [1, 6, 10, 14]) {
      const [r, g, b] = mixAt(x, 0, 16);
      expectNear(at(x, 2), [Math.min(255, r * 2), g, b, 255]);
    }
  });

  it('batches a vertex-colored stroke with its fill', () => {
    const stroke: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 2.5, y: 0.5, width: 11, height: 3 },
      fill: { paint: { color: '#00ff00' } },
      stroke: { width: 1, paint: { color: '#ffffff' }, vertexColors: [...RED, ...RED, ...RED, ...RED] },
    } as DrawCommand;
    const at = paint([stroke]);
    expect(draws).toBe(1);
    expectNear(at(8, 2), [0, 255, 0, 255]);
    expectNear(at(8, 0), [255, 0, 0, 255]);
  });
});
