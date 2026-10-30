import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { viewToMat3 } from '@weasel-js/geom';
import { FLOATS_PER_VERTEX } from './drawBatch';

/**
 * Far from the origin and zoomed in: the view translation is near 1.68e7,
 * where a float32 holds whole pixels at best. Nothing here runs a shader, so
 * the own-draw half replays the vertex shader's float32 arithmetic over what
 * the renderer uploaded.
 */
const WORLD_X = 262_144;
const ZOOM = 64;
const STEP_PX = 0.25;
const PANS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const viewPannedBy = (px: number) => ({ x: WORLD_X - px / ZOOM, y: 0, scale: { x: ZOOM, y: ZOOM } });

function frame(children: DrawCommand[], px: number) {
  const rec = makeGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
  rec.reset();
  const view = viewToMat3(viewPannedBy(px));
  r.render([{ kind: 'group', transform: view, children }], view);
  return { rec, r };
}

describe('precision far from the origin (world x = 262,144 at 64x)', () => {
  it('pans a batched rect in quarter-pixel steps', () => {
    const rect: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: WORLD_X, y: 1, width: 1, height: 1 },
      fill: { paint: { kind: 'solid', color: '#f00' } },
    };
    const lefts = PANS.map((k) => {
      const { rec, r } = frame([rect], k * STEP_PX);
      let bound: unknown = null;
      let verts: Float32Array | null = null;
      for (const c of rec.calls) {
        if (c.name === 'useProgram') bound = c.args[0];
        if (bound === r._batchFill().handle && c.name === 'bufferSubData' && c.args[2] instanceof Float32Array) {
          verts = c.args[2];
        }
      }
      let left = Infinity;
      for (let i = 0; i < 4 * FLOATS_PER_VERTEX; i += FLOATS_PER_VERTEX) left = Math.min(left, verts![i]);
      return left;
    });
    expect(lefts).toEqual(PANS.map((k) => k * STEP_PX));
  });

  /** The path programs' `u_model * vec3(a_position, 1.0)`, x only, in float32. */
  function shadedX(model: Float32Array, x: number, y: number): number {
    const f = Math.fround;
    return f(f(f(model[0] * x) + f(model[3] * y)) + model[6]);
  }

  function ownDrawLefts(coords: Float32Array, wrap: (cmd: DrawCommand) => DrawCommand): number[] {
    const path: DrawCommand = {
      kind: 'path',
      path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 3]), coords, fillRule: 'evenodd' },
      fill: { paint: { kind: 'solid', color: '#fff' } },
      // An even-odd fill keeps out of the batch, and per-vertex colors pick
      // the program this reads.
      vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
    } as unknown as DrawCommand;
    return PANS.map((k) => {
      const { rec, r } = frame([wrap(path)], k * STEP_PX);
      const prog = r._pathFillVColor();
      const last = (name: string, uniform: string) => rec.calls
        .filter((c) => c.name === name && c.args[0] === prog.uniform(uniform)).at(-1);
      const model = last('uniformMatrix3fv', 'u_model')!.args[2] as Float32Array;
      const origin = last('uniform2f', 'u_origin');
      const ox = origin ? origin.args[1] as number : 0;
      const oy = origin ? origin.args[2] as number : 0;
      // GL converts the uniform to float32 whatever array it arrived in.
      const uploaded = Float32Array.from(model);
      const f = Math.fround;
      let left = Infinity;
      for (let i = 0; i < coords.length; i += 2) {
        left = Math.min(left, shadedX(uploaded, f(coords[i] - f(ox)), f(coords[i + 1] - f(oy))));
      }
      return left;
    });
  }

  it('pans an own-draw mesh whose vertices are far from the origin in quarter-pixel steps', () => {
    const lefts = ownDrawLefts(
      new Float32Array([WORLD_X, 1, WORLD_X + 1, 1, WORLD_X, 2]),
      (cmd) => cmd,
    );
    expect(lefts).toEqual(PANS.map((k) => k * STEP_PX));
  });

  it('pans an own-draw mesh placed far away by a group in quarter-pixel steps', () => {
    const lefts = ownDrawLefts(
      new Float32Array([0, 1, 1, 1, 0, 2]),
      (cmd) => ({
        kind: 'group',
        transform: new Float32Array([1, 0, 0, 0, 1, 0, WORLD_X, 0, 1]),
        children: [cmd],
      }),
    );
    expect(lefts).toEqual(PANS.map((k) => k * STEP_PX));
  });

  it('places an own-draw mesh under a rotated, far-away view to a hundredth of a pixel', () => {
    const [cx, cy] = [WORLD_X, WORLD_X / 2];
    const coords = new Float32Array([cx, cy, cx + 1.5, cy + 0.25, cx - 0.75, cy + 2]);
    const turn = Math.PI / 6;
    const [cos, sin] = [Math.cos(turn) * ZOOM, Math.sin(turn) * ZOOM];
    // Rotate about (cx, cy) and put that point at screen (300.3, 200.7).
    const view = new Float64Array([
      cos, sin, 0,
      -sin, cos, 0,
      300.3 - (cos * cx - sin * cy), 200.7 - (sin * cx + cos * cy), 1,
    ]);
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
    rec.reset();
    r.render([{
      kind: 'group',
      transform: view,
      children: [{
        kind: 'path',
        path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 3]), coords, fillRule: 'evenodd' },
        fill: { paint: { kind: 'solid', color: '#fff' } },
        vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
      } as unknown as DrawCommand],
    }]);
    const prog = r._pathFillVColor();
    const last = (name: string, uniform: string) => rec.calls
      .filter((c) => c.name === name && c.args[0] === prog.uniform(uniform)).at(-1)!;
    const model = last('uniformMatrix3fv', 'u_model').args[2] as Float32Array;
    const [ox, oy] = last('uniform2f', 'u_origin').args.slice(1) as number[];
    const f = Math.fround;
    for (let i = 0; i < coords.length; i += 2) {
      const [lx, ly] = [f(coords[i] - f(ox)), f(coords[i + 1] - f(oy))];
      const gotX = f(f(f(model[0] * lx) + f(model[3] * ly)) + model[6]);
      const gotY = f(f(f(model[1] * lx) + f(model[4] * ly)) + model[7]);
      const wantX = view[0] * coords[i] + view[3] * coords[i + 1] + view[6];
      const wantY = view[1] * coords[i] + view[4] * coords[i + 1] + view[7];
      expect(Math.abs(gotX - wantX)).toBeLessThan(0.01);
      expect(Math.abs(gotY - wantY)).toBeLessThan(0.01);
    }
  });

  it('sends an ordinary transform as it is, with no origin', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
    rec.reset();
    const transform = new Float64Array([2, 0, 0, 0, 2, 0, 1000.5, -40.25, 1]);
    r.render([{
      kind: 'group',
      transform,
      children: [{
        kind: 'path',
        path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 3]), coords: new Float32Array([0, 0, 4, 0, 0, 4]), fillRule: 'evenodd' },
        fill: { paint: { kind: 'solid', color: '#fff' } },
        vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
      } as unknown as DrawCommand],
    }]);
    const prog = r._pathFillVColor();
    const of = (name: string, uniform: string) => rec.calls
      .filter((c) => c.name === name && c.args[0] === prog.uniform(uniform));
    expect(of('uniformMatrix3fv', 'u_model').map((c) => Array.from(c.args[2] as Float32Array)))
      .toEqual([Array.from(transform)]);
    expect(of('uniform2f', 'u_origin').map((c) => c.args.slice(1))).toEqual([[0, 0]]);
  });
});
