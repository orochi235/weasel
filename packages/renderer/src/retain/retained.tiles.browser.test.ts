/**
 * A retained surface drawn in tiles, against real WebGL2: every frame of a
 * renderer whose scratch buffer is a few dozen pixels on a side is compared
 * channel by channel with one drawing each surface whole — inside the buffer,
 * through a margin past it, with a blur reaching across a tile's edge, and
 * single-sampled inside an effects buffer.
 *
 * Tiles share the surface's projection and slide their viewport by whole
 * pixels, so they agree exactly but for one thing: the GPU adds the
 * viewport's offset in float32, and where an edge runs within that rounding
 * error of a sample, the sample flips. One flipped sample in a frame is the
 * allowance.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mat3, pathFromD, type GlMat3 } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import { _resetProgramRegistryForTests, registerProgram } from '../shaders/registerProgram';
import { blur } from '../effects/builtins';
import type { RetainedSurfaces } from './RetainedSurfaces';

const W = 64;
const H = 48;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;
/** Odd, so tile edges cross every kind of content at odd offsets. */
const TILE = 37;

const GROUND: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
];

const HEAD = '#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 o;\n';
const BY_ORIGIN = `${HEAD}uniform vec2 u_fragOrigin;
void main() {
  vec2 p = gl_FragCoord.xy - u_fragOrigin;
  o = vec4(fract(p.x / 7.0), fract(p.y / 5.0), 0.25, 1.0);
}`;

/** Content past every edge of the buffer: fractional translucent rects, a
 *  circle, a curved stroke, a world-unit gradient, and a clipped group. */
function world(): DrawCommand[] {
  const cmds: DrawCommand[] = [];
  for (let i = -3; i < 9; i++) {
    for (let j = -3; j < 7; j++) {
      cmds.push({
        kind: 'path', path: { kind: 'rect', x: i * 11 + 0.3, y: j * 9 + 0.7, width: 6.2, height: 4.9 },
        fill: { paint: { color: `rgba(${(i * 40) & 255}, ${(j * 60) & 255}, 180, 0.7)` } },
      });
    }
  }
  cmds.push(
    { kind: 'path', path: pathFromD('M20 20 A13 13 0 1 1 19.99 20 Z'), fill: { paint: { color: '#ffcc00' } } },
    { kind: 'path', path: pathFromD('M-20 60 C 10 -10, 50 90, 90 10'), stroke: { paint: { color: '#ff3366' }, width: 1.7 } },
    {
      kind: 'path', path: { kind: 'rect', x: 40, y: -10, width: 30, height: 70 },
      fill: { paint: { kind: 'linear-gradient', from: { x: 40, y: 0 }, to: { x: 70, y: 0 }, units: 'world', stops: [{ offset: 0, color: 'rgba(0,255,0,0.5)' }, { offset: 1, color: 'rgba(255,0,255,0.5)' }] } },
    },
    {
      kind: 'group', clip: pathFromD('M8 30 L40 22 L36 46 Z'),
      children: [{ kind: 'path', path: pathFromD('M0 20 C 20 60, 40 0, 60 40'), stroke: { paint: { color: '#ffffff' }, width: 3 } }],
    },
  );
  return cmds;
}

const BLURRED: DrawCommand = {
  kind: 'group', effects: blur({ radius: 5 }),
  children: [
    { kind: 'path', path: { kind: 'rect', x: 15, y: 10, width: 12, height: 14 }, fill: { paint: { color: '#ffffff' } } },
    { kind: 'path', path: { kind: 'rect', x: 30, y: 16, width: 16, height: 5 }, fill: { paint: { color: 'rgba(255, 0, 0, 0.8)' } } },
    { kind: 'path', path: { kind: 'rect', x: -6, y: 36, width: 80, height: 20 }, fill: { paint: { color: '#00ffcc' } } },
  ],
};

interface Pair { tiled: WeaselRenderer; whole: WeaselRenderer; tiledGl: WebGL2RenderingContext; wholeGl: WebGL2RenderingContext }
const open: Pair[] = [];

afterEach(() => {
  for (const p of open.splice(0)) {
    p.tiled.dispose();
    p.whole.dispose();
  }
  _resetProgramRegistryForTests();
});

function context(): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  return canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true })!;
}

const storeOf = (r: WeaselRenderer): RetainedSurfaces => (r as unknown as { retained: RetainedSurfaces }).retained;

function pairOf(): Pair {
  const tiledGl = context();
  const wholeGl = context();
  const p = {
    tiledGl, wholeGl,
    tiled: new WeaselRenderer({ gl: tiledGl, width: W, height: H, dpr: DPR }),
    whole: new WeaselRenderer({ gl: wholeGl, width: W, height: H, dpr: DPR }),
  };
  storeOf(p.tiled).tile = TILE;
  storeOf(p.whole).tile = Infinity;
  open.push(p);
  return p;
}

function read(gl: WebGL2RenderingContext, r: WeaselRenderer, commands: DrawCommand[], view: GlMat3): Uint8Array {
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0.1, 0.8, 0.3, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  r.render(commands, view);
  const px = new Uint8Array(DW * DH * 4);
  gl.readPixels(0, 0, DW, DH, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** How many pixels differ at all, and by how much at most. */
function diff(a: Uint8Array, b: Uint8Array): { max: number; off: number } {
  let max = 0;
  let off = 0;
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    max = Math.max(max, d);
    if (d > 0) off++;
  }
  return { max, off };
}

/** One frame with `layer(view)` retained, under view translation `x, y`. */
function frame(p: Pair, x: number, y: number, layer: (view: GlMat3) => DrawCommand) {
  const view = mat3.translated(mat3.identity(), x, y);
  const tiled = read(p.tiledGl, p.tiled, [...GROUND, layer(view)], view);
  const whole = read(p.wholeGl, p.whole, [...GROUND, layer(view)], view);
  return { ...diff(tiled, whole), tiled: p.tiled.lastFrameStats().retained, whole: p.whole.lastFrameStats().retained };
}

const worldLayer = (children: DrawCommand[]) => (view: GlMat3): DrawCommand => ({ kind: 'group', transform: view, retain: 'L', children });

describe('a retained surface drawn in tiles', () => {
  it('matches the surface drawn whole inside the buffer, and holds a scratch buffer no larger than a tile', () => {
    const p = pairOf();
    const shader: DrawCommand = {
      kind: 'shader', bounds: { x: 2, y: 3, w: 40, h: 30 }, uniforms: {},
      program: registerProgram('tiles-by-origin', '', BY_ORIGIN),
    };
    const children = [...world(), shader];
    const layer = (): DrawCommand => ({ kind: 'group', retain: 'L', children });
    const first = frame(p, 0, 0, layer);
    expect(first.tiled).toMatchObject({ redrawn: 1 });
    expect(first, 'tiled against whole').toMatchObject({ max: 0 });
    expect(first.tiled.bytes).toBeLessThan(first.whole.bytes);
    // The surface is the drawing buffer; the scratch buffer at most a tile,
    // with the single-sampled copy tiles resolve through.
    const samples = 4;
    expect(first.tiled.bytes).toBeLessThanOrEqual(DW * DH * 4 + TILE * TILE * (8 * samples + 4));
    expect(frame(p, 0, 0, layer)).toMatchObject({ max: 0, tiled: { composited: 1 } });
  });

  it('matches it through a pan, margin past the buffer included', () => {
    const p = pairOf();
    const layer = worldLayer(world());
    frame(p, 0, 0, layer);
    frame(p, 0, 0, layer);
    const margin = frame(p, 3.5, -2, layer);
    expect(margin.tiled).toMatchObject({ redrawn: 1 });
    // A flipped sample is at most a quarter of a pixel's coverage at 4x.
    expect(margin.off).toBeLessThanOrEqual(1);
    expect(margin.max).toBeLessThanOrEqual(64);
    for (const [x, y] of [[5, -3], [8, 1], [1 + W / 4, 0]]) {
      const moved = frame(p, x, y, layer);
      expect(moved.off, `at ${x}, ${y}`).toBeLessThanOrEqual(1);
      expect(moved.max, `at ${x}, ${y}`).toBeLessThanOrEqual(64);
    }
  });

  it('matches it with a blur reaching across tile edges, in place and through a pan', () => {
    const p = pairOf();
    const layer = worldLayer([BLURRED]);
    expect(frame(p, 0, 0, layer)).toMatchObject({ max: 0, tiled: { redrawn: 1 } });
    frame(p, 0, 0, layer);
    let redrawn = 0;
    for (const [x, y] of [[3.5, -2], [3.5 + W / 4, -2], [-W / 4, 6]]) {
      const moved = frame(p, x, y, layer);
      expect(moved, `at ${x}, ${y}`).toMatchObject({ max: 0 });
      redrawn += moved.tiled.redrawn;
    }
    expect(redrawn).toBeGreaterThan(0);
  });

  it('matches it for a retained group owning an effects buffer, and single-sampled inside one', () => {
    const p = pairOf();
    const owns = (): DrawCommand => ({ ...BLURRED, retain: 'L' });
    expect(frame(p, 0, 0, owns)).toMatchObject({ max: 0, tiled: { redrawn: 1 } });
    const inside = (): DrawCommand => ({
      kind: 'group', effects: blur({ radius: 3 }),
      children: [{ kind: 'group', retain: 'inner', children: world() }],
    });
    expect(frame(p, 0, 0, inside)).toMatchObject({ max: 0, tiled: { redrawn: 1 } });
  });
});
