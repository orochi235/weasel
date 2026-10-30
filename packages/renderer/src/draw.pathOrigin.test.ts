import { describe, it, expect } from 'vitest';
import { PathBuilder, viewToMat3, type PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

/**
 * A path whose own coordinates are far from the origin, at world x = 262,144
 * and 64x: a float32 there sits on a 1/32 world-unit grid, 2 px. Its left
 * edge is 0.3 past the far point, which that grid moves to 0.3125, 0.8 px off.
 * Nothing here runs a shader, so the own-draw half replays the vertex
 * shader's float32 arithmetic over what the renderer uploaded.
 */
const WORLD_X = 262_144;
const ZOOM = 64;
const LEFT = 0.3;
const STEP_PX = 0.25;
const PANS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** The left edge's screen x at pan `px`, in doubles. */
const wantLeft = (px: number) => LEFT * ZOOM + px;

function triangle(origin: boolean): PolygonPath {
  const b = new PathBuilder();
  if (origin) b.setOrigin(WORLD_X, 0);
  return b.moveTo(WORLD_X + LEFT, 1).lineTo(WORLD_X + LEFT + 1, 1).lineTo(WORLD_X + LEFT, 2).close().build();
}

function frame(cmd: DrawCommand, px: number) {
  const rec = makeGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
  rec.reset();
  const view = viewToMat3({ x: WORLD_X - px / ZOOM, y: 0, scale: { x: ZOOM, y: ZOOM } });
  r.render([{ kind: 'group', transform: view, children: [cmd] }], view);
  return { rec, r };
}

function batchedLefts(path: PolygonPath): number[] {
  const cmd: DrawCommand = { kind: 'path', path, fill: { paint: { kind: 'solid', color: '#f00' } } };
  return PANS.map((k) => {
    const { rec, r } = frame(cmd, k * STEP_PX);
    let bound: unknown = null;
    let verts: Float32Array | null = null;
    for (const c of rec.calls) {
      if (c.name === 'useProgram') bound = c.args[0];
      if (bound === r._batchFill().handle && c.name === 'bufferSubData' && c.args[2] instanceof Float32Array) {
        verts = c.args[2];
      }
    }
    let left = Infinity;
    for (let i = 0; i < 3 * FLOATS_PER_VERTEX; i += FLOATS_PER_VERTEX) left = Math.min(left, verts![i]);
    return left;
  });
}

function ownDrawLefts(path: PolygonPath): number[] {
  const cmd = {
    kind: 'path',
    // A touching even-odd fill keeps out of the batch, and per-vertex colors pick the
    // program this reads.
    path: stencilledEvenOdd(path),
    fill: { paint: { kind: 'solid', color: '#fff' } },
    vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
  } as unknown as DrawCommand;
  return PANS.map((k) => {
    const { rec, r } = frame(cmd, k * STEP_PX);
    const prog = r._pathFillVColor();
    const last = (name: string, uniform: string) => rec.calls
      .filter((c) => c.name === name && c.args[0] === prog.uniform(uniform)).at(-1);
    // GL converts the uniform to float32 whatever array it arrived in.
    const model = Float32Array.from(last('uniformMatrix3fv', 'u_model')!.args[2] as Float32Array);
    const origin = last('uniform2f', 'u_origin');
    const ox = origin ? origin.args[1] as number : 0;
    const oy = origin ? origin.args[2] as number : 0;
    const f = Math.fround;
    const c = path.coords;
    let left = Infinity;
    for (let i = 0; i < c.length; i += 2) {
      const [x, y] = [f(c[i] - f(ox)), f(c[i + 1] - f(oy))];
      left = Math.min(left, f(f(f(model[0] * x) + f(model[3] * y)) + model[6]));
    }
    return left;
  });
}

const offBy = (lefts: number[]) => Math.max(...lefts.map((l, k) => Math.abs(l - wantLeft(k * STEP_PX))));

describe('a path carrying an origin, far from the world origin at 64x', () => {
  it('holds a fraction its coordinates could not', () => {
    expect(offBy(batchedLefts(triangle(false)))).toBeGreaterThan(0.5);
    expect(offBy(ownDrawLefts(triangle(false)))).toBeGreaterThan(0.5);
  });

  it('places a batched fill to a hundredth of a pixel', () => {
    expect(offBy(batchedLefts(triangle(true)))).toBeLessThan(0.01);
  });

  it('places an own-draw fill to a hundredth of a pixel', () => {
    expect(offBy(ownDrawLefts(triangle(true)))).toBeLessThan(0.01);
  });

  it('rasterizes a stencil clip with an origin from that origin', () => {
    // Concave, so the clip goes through the stencil rather than a hull.
    const clip = new PathBuilder().setOrigin(WORLD_X, 0)
      .moveTo(WORLD_X + LEFT, 1).lineTo(WORLD_X + LEFT + 2, 1).lineTo(WORLD_X + LEFT + 1, 1.5)
      .lineTo(WORLD_X + LEFT, 3).close().build();
    const { rec, r } = frame({
      kind: 'group',
      clip,
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: WORLD_X, y: 0, width: 4, height: 4 },
        fill: { paint: { kind: 'solid', color: '#f00' } },
      }],
    } as unknown as DrawCommand, 0);
    const prog = r._pathFill();
    const last = (name: string, uniform: string) => rec.calls
      .filter((c) => c.name === name && c.args[0] === prog.uniform(uniform)).at(-1);
    const model = Float32Array.from(last('uniformMatrix3fv', 'u_model')!.args[2] as Float32Array);
    const origin = last('uniform2f', 'u_origin');
    const ox = origin ? origin.args[1] as number : 0;
    const f = Math.fround;
    const shaded = f(f(model[0] * f(clip.coords[0] - f(ox))) + model[6]);
    expect(Math.abs(shaded - wantLeft(0))).toBeLessThan(0.01);
  });
});
