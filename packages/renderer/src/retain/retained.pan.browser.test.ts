/**
 * A retained world layer through a pan, against real WebGL2: each frame of
 * the retained renderer is compared channel by channel with a second renderer
 * drawing the same layer straight through at the same view, so a surface
 * moved a pixel off, a margin cut short, or a stale surface reused all show.
 *
 * Drawing is not exactly shift-invariant even straight through: a vertex
 * translated in float32 rounds differently, and where an edge runs within a
 * rounding error of a sample that sample flips. Two direct draws a whole pixel
 * apart differ that way along a thin slanted stroke, so a surface moved with
 * the view, or drawn under a projection aimed past the buffer, may too. The
 * last test holds a thin slanted stroke to that envelope; the rest allow a
 * few such pixels in content that mostly stays clear of it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mat3, pathFromD, type GlMat3 } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import type { RetainedStats } from '../rendererTypes';
import { registerProgram } from '../shaders/registerProgram';

const W = 64;
const H = 48;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;

const GROUND: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
];

/** World content running well past every edge of the buffer: fractional
 *  rects, a circle, a curved stroke, translucency and a world-unit gradient. */
function world(extra: DrawCommand[] = []): DrawCommand[] {
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
    ...extra,
  );
  return cmds;
}

/** A thin stroke slanting across the buffer and past it. */
const SLANTED: DrawCommand[] = [
  { kind: 'path', path: pathFromD('M-10 5 L30 -8 L75 30 L12 52 Z'), stroke: { paint: { color: '#ffffff' }, width: 0.8 } },
];

interface Pair { kept: WeaselRenderer; direct: WeaselRenderer; keptGl: WebGL2RenderingContext; directGl: WebGL2RenderingContext }
const open: Pair[] = [];

afterEach(() => {
  for (const p of open.splice(0)) {
    p.kept.dispose();
    p.direct.dispose();
  }
});

function context(): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  return canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true })!;
}

function pairOf(): Pair {
  const keptGl = context();
  const directGl = context();
  const p = {
    keptGl, directGl,
    kept: new WeaselRenderer({ gl: keptGl, width: W, height: H, dpr: DPR }),
    direct: new WeaselRenderer({ gl: directGl, width: W, height: H, dpr: DPR }),
  };
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

/** The largest channel difference between `a` and `b`, and how many pixels
 *  differ by more than 8-bit rounding: `b` read `sx, sy` device pixels
 *  right and down of `a`, where both cover it. */
function diff(a: Uint8Array, b: Uint8Array, sx = 0, sy = 0): { max: number; off: number } {
  let max = 0;
  let off = 0;
  for (let y = Math.max(0, -sy); y < Math.min(DH, DH - sy); y++) {
    for (let x = Math.max(0, -sx); x < Math.min(DW, DW - sx); x++) {
      const i = ((DH - 1 - y) * DW + x) * 4;
      const j = ((DH - 1 - y - sy) * DW + x + sx) * 4;
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[j + c]));
      max = Math.max(max, d);
      if (d > 1) off++;
    }
  }
  return { max, off };
}

const viewAt = (x: number, y: number): GlMat3 => mat3.translated(mat3.identity(), x, y);

/** One frame at view translation `x, y` CSS px: both renderers' pixels, and
 *  how the retained one drew it. */
function frame(p: Pair, x: number, y: number, children: DrawCommand[]) {
  const view = viewAt(x, y);
  const layer = (retain?: string): DrawCommand => ({ kind: 'group', transform: view, retain, children });
  const kept = read(p.keptGl, p.kept, [...GROUND, layer('world')], view);
  const direct = read(p.directGl, p.direct, [...GROUND, layer()], view);
  const stats: RetainedStats = p.kept.lastFrameStats().retained;
  return { ...diff(kept, direct), stats, direct };
}

describe('a retained world layer through a pan, in a real context', () => {
  it('composites its surface moved by whole device pixels, matching a direct draw', () => {
    const p = pairOf();
    const children = world();
    frame(p, 0, 0, children);
    expect(frame(p, 0, 0, children).stats).toMatchObject({ composited: 1, redrawn: 0 });
    // The first move outruns a surface drawn to the buffer: drawn again with
    // a margin, under a projection aimed past the buffer.
    const first = frame(p, 3.5, -2, children);
    expect(first.stats).toMatchObject({ redrawn: 1 });
    expect(first.off).toBeLessThanOrEqual(4);
    for (const [x, y] of [[5, -3], [8, 1], [-1.5, 1.5], [11, -6.5]]) {
      const moved = frame(p, x, y, children);
      expect(moved.stats, `at ${x}, ${y}`).toMatchObject({ composited: 1, redrawn: 0 });
      // At most a sample flipped where the translated stroke rounds differently.
      expect(moved.off, `at ${x}, ${y}`).toBeLessThanOrEqual(4);
    }
  });

  it('draws a fractional move straight through, and again once it holds', () => {
    const p = pairOf();
    const children = world();
    frame(p, 0, 0, children);
    frame(p, 0, 0, children);
    frame(p, 1, 0, children);
    const through = frame(p, 1.3, 0.1, children);
    expect(through.stats).toMatchObject({ declined: 1, composited: 0, redrawn: 0 });
    expect(through.max).toBe(0);
    const held = frame(p, 1.3, 0.1, children);
    expect(held.stats).toMatchObject({ redrawn: 1 });
    expect(held.off).toBeLessThanOrEqual(4);
    const after = frame(p, 2.3, 1.1, children);
    expect(after.stats).toMatchObject({ composited: 1 });
    expect(after.off).toBeLessThanOrEqual(4);
  });

  it('draws again once a move runs past the margin', () => {
    const p = pairOf();
    const children = world();
    frame(p, 0, 0, children);
    frame(p, 0, 0, children);
    frame(p, 1, 0, children);
    const far = frame(p, 1 + W / 4, 0, children);
    expect(far.stats).toMatchObject({ redrawn: 1 });
    expect(far.off).toBeLessThanOrEqual(4);
  });

  it('draws a layer holding a screen-unit gradient or a shader again for every move', () => {
    const screenGradient: DrawCommand = {
      kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 30, height: 30 },
      fill: { paint: { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: W, y: 0 }, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] } },
    };
    const shader: DrawCommand = {
      kind: 'shader', bounds: { x: 4, y: 4, w: 10, h: 10 }, uniforms: {},
      program: registerProgram('pan-test-solid', '', '#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 o;\nvoid main() { o = vec4(0.0, 0.0, 1.0, 1.0); }'),
    };
    for (const extra of [screenGradient, shader]) {
      const p = pairOf();
      const children = world([extra]);
      frame(p, 0, 0, children);
      frame(p, 0, 0, children);
      const moved = frame(p, 1, 0, children);
      expect(moved.stats, extra.kind).toMatchObject({ redrawn: 1, composited: 0 });
      // Drawn in its surface over translucent content: resolve rounding.
      expect(moved.max, extra.kind).toBeLessThanOrEqual(2);
    }
  });

  it('differs from a direct draw along a thin slanted stroke no more than two direct draws a pixel apart do', () => {
    const p = pairOf();
    const moves = [[5, -3], [8, 1], [-1.5, 1.5]] as const;
    frame(p, 0, 0, SLANTED);
    frame(p, 0, 0, SLANTED);
    const base = frame(p, 3.5, -2, SLANTED);
    let kept = 0;
    let between = 0;
    let worst = 0;
    for (const [x, y] of moves) {
      const moved = frame(p, x, y, SLANTED);
      expect(moved.stats).toMatchObject({ composited: 1 });
      kept += moved.off;
      worst = Math.max(worst, moved.max);
      between += diff(base.direct, moved.direct, (x - 3.5) * DPR, (y + 2) * DPR).off;
    }
    // A flipped sample is a quarter of a pixel's coverage at 4x, two of them half.
    expect(worst).toBeLessThanOrEqual(128);
    expect(kept, `${kept} pixels off retained vs direct, ${between} direct vs direct moved`).toBeLessThanOrEqual(2 * between + 8);
  });
});
