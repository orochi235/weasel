import { describe, it, expect } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z, type PolygonPath } from '@weasel-js/geom';
import type { DrawCommand } from './DrawCommand';
import { dispatch } from './draw';
import { createRecorderCtx } from './testing/recorderCtx';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

/**
 * Per-vertex colors join the batch, so these exercise the vertex-color program
 * the way a fill or stroke still reaches it: an even-odd fill too costly to
 * resolve (`stencilledEvenOdd`), or a ribbon past the most vertices a run
 * takes (`meshBatching`).
 */
const LONG = 1200;
const zigzag = {
  kind: 'polygon',
  commands: new Uint8Array([M, ...Array.from({ length: LONG - 1 }, () => L)]),
  coords: new Float32Array(Array.from({ length: LONG }, (_, k) => [k, (k % 2) * 3]).flat()),
  fillRule: 'nonzero',
};
const longColors = Array.from({ length: LONG }, (_, k) => [k % 2, 0, 1 - (k % 2), 1]).flat();

describe('per-vertex color buffer lifetime', () => {
  const vColors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
  const fillCmd = {
    kind: 'path',
    path: stencilledEvenOdd({
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, Z]),
      coords: new Float32Array([0, 0, 50, 0, 50, 50]),
    }),
    fill: { paint: { kind: 'solid', color: '#ffffff' } },
    vertexColors: vColors,
  } as unknown as DrawCommand;
  const strokeCmd = {
    kind: 'path',
    path: zigzag,
    stroke: { width: 4, paint: { color: '#ffffff' }, vertexColors: longColors },
  } as unknown as DrawCommand;

  // A mesh's own geometry outlives the draw, so the colors ride a geometry of
  // their own, freed before its buffer: a deleted buffer still attached to a
  // live vertex array is neither freed nor valid to draw with.
  it.each([['fill', fillCmd], ['stroke', strokeCmd]])(
    'a %s draws its colors through a geometry of its own, freed with its buffer',
    (_name, cmd) => {
      const { ctx, calls } = createRecorderCtx();
      const colorLoc = ctx.pathFillVColor.attribute('a_vertexColor');
      dispatch(ctx, cmd);

      const enable = calls.findIndex((c) => c.name === 'enableVertexAttribArray' && c.args[0] === colorLoc);
      const made = calls.slice(0, enable).filter((c) => c.name === 'createVertexArray').at(-1)?.result;
      const draw = calls.findIndex((c, i) => i > enable && c.name === 'drawElements');
      const freed = calls.findIndex((c, i) => i > draw && c.name === 'deleteVertexArray' && c.args[0] === made);
      const del = calls.findIndex((c, i) => i > freed && c.name === 'deleteBuffer');
      expect(enable).toBeGreaterThanOrEqual(0);
      expect(made).toBeDefined();
      expect(draw).toBeGreaterThan(enable);
      expect(freed).toBeGreaterThan(draw);
      expect(del).toBeGreaterThan(freed);
    },
  );
});

describe('vertex-colored stroke under a clip', () => {
  /** A stroke command whose per-anchor colors force the vertex-color program
   *  (and so the branch that draws the ribbon with its own color buffer). */
  function vColorStroke(): DrawCommand {
    return {
      kind: 'path',
      path: zigzag,
      stroke: { width: 4, paint: { color: '#ffffff' }, vertexColors: longColors },
    } as unknown as DrawCommand;
  }

  /** The stencil test each draw runs under: `null` with it off, else the clip bits it reads and wants set. */
  function drawTests(calls: readonly { name: string; args: readonly unknown[] }[], gl: { STENCIL_TEST: number }) {
    let on = false;
    let func: { mask: number; ref: number } | null = null;
    const out: ({ clipBits: number; wanted: number } | null)[] = [];
    for (const c of calls) {
      if (c.name === 'enable' && c.args[0] === gl.STENCIL_TEST) on = true;
      if (c.name === 'disable' && c.args[0] === gl.STENCIL_TEST) on = false;
      if (c.name === 'stencilFunc') func = { ref: c.args[1] as number, mask: c.args[2] as number };
      if (c.name === 'drawElements') out.push(on && func ? { clipBits: func.mask & 0xfe, wanted: func.ref & func.mask & 0xfe } : null);
    }
    return out;
  }

  // Past what a run takes, the ribbon marks and covers through the stencil, both passes under the clip.
  it('applies the clip test to each of its draws', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 1;
    dispatch(ctx, vColorStroke());
    const tests = drawTests(calls, gl);
    expect(tests.length).toBeGreaterThanOrEqual(2);
    for (const t of tests) expect(t).toEqual({ clipBits: 0x02, wanted: 0x02 });
  });

  it('reads no clip bit when nothing clips it', () => {
    // Without this the ribbon inherits whatever a previous clip left behind —
    // a popClip's EQUAL against a now-cleared bit discards the whole draw.
    const { ctx, calls, gl } = createRecorderCtx();
    dispatch(ctx, vColorStroke());
    const tests = drawTests(calls, gl);
    expect(tests.length).toBeGreaterThanOrEqual(2);
    for (const t of tests) expect(t?.clipBits ?? 0).toBe(0);
  });
});

describe('vertex colors on a path with corner shapes', () => {
  const RED = [1, 0, 0, 1], GREEN = [0, 1, 0, 1], BLUE = [0, 0, 1, 1], WHITE = [1, 1, 1, 1];

  /** The per-vertex colors the fill uploads, four floats a vertex. */
  function uploadedColors(cmd: DrawCommand): number[][] {
    const { ctx, calls } = createRecorderCtx();
    const colorLoc = ctx.pathFillVColor.attribute('a_vertexColor');
    dispatch(ctx, cmd);
    const enable = calls.findIndex((c) => c.name === 'enableVertexAttribArray' && c.args[0] === colorLoc);
    const upload = calls.slice(0, enable).reverse().find((c) => c.name === 'bufferData')!;
    const data = Array.from(upload.args[1] as Float32Array);
    const out: number[][] = [];
    for (let i = 0; i < data.length; i += 4) out.push(data.slice(i, i + 4));
    return out;
  }

  /** The same, as the batch stages them: a nonzero fill joins the run. */
  function stagedColors(cmd: DrawCommand): number[][] {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 200, height: 200, dpr: 1 });
    rec.reset();
    r.render([cmd]);
    const upload = rec.calls.find((c) => c.name === 'bufferSubData' && c.args[0] === rec.gl.ARRAY_BUFFER)!;
    const verts = upload.args[2] as Float32Array;
    const out: number[][] = [];
    for (let i = 0; i < (upload.args[4] as number); i += FLOATS_PER_VERTEX) out.push(Array.from(verts.slice(i + 2, i + 6)));
    return out;
  }

  const cornered = (fillRule: string): DrawCommand => ({
    kind: 'path',
    path: {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
      fillRule,
      corners: [null, { shape: 'bevel', radius: 20 }],
    },
    fill: { paint: { kind: 'solid', color: '#ffffff' } },
    vertexColors: [...RED, ...GREEN, ...BLUE, ...WHITE],
  } as unknown as DrawCommand);

  it("gives a cut corner's points that corner's anchor color in the batch", () => {
    const colors = stagedColors(cornered('nonzero'));
    expect(colors).toHaveLength(5);
    expect(colors.filter((c) => c.every((v, i) => v === GREEN[i]))).toHaveLength(2);
    for (const c of colors) expect(c.some(Number.isNaN)).toBe(false);
  });

  it("gives a cut corner's points that corner's anchor color", () => {
    // The added contour's two points take the colors of anchors 0 and 1, after the outline's five.
    const plain = cornered('evenodd') as DrawCommand & { path: PolygonPath; vertexColors: number[] };
    const colors = uploadedColors({
      ...plain,
      path: stencilledEvenOdd(plain.path),
      vertexColors: [...plain.vertexColors, ...RED, ...GREEN],
    } as DrawCommand).slice(0, 5);
    expect(colors).toHaveLength(5);
    expect(colors.filter((c) => c.every((v, i) => v === GREEN[i]))).toHaveLength(2);
    for (const c of colors) expect(c.some(Number.isNaN)).toBe(false);
  });
});
