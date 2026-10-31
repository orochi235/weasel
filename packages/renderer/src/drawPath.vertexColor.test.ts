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

  // A mesh VAO outlives the draw, and a deleted buffer still attached to one
  // is neither freed nor valid to draw with.
  it.each([['fill', fillCmd], ['stroke', strokeCmd]])(
    'a %s leaves its mesh VAO with the color attribute off and its buffer detached',
    (_name, cmd) => {
      const { ctx, calls } = createRecorderCtx();
      const colorLoc = ctx.pathFillVColor.attribute('a_vertexColor');
      dispatch(ctx, cmd);

      const enable = calls.findIndex((c) => c.name === 'enableVertexAttribArray' && c.args[0] === colorLoc);
      const draw = calls.findIndex((c, i) => i > enable && c.name === 'drawElements');
      const disable = calls.findIndex((c, i) => i > draw && c.name === 'disableVertexAttribArray' && c.args[0] === colorLoc);
      const del = calls.findIndex((c, i) => i > disable && c.name === 'deleteBuffer');
      const unbind = calls.findIndex((c, i) => i > draw && c.name === 'bindVertexArray' && c.args[0] === null);
      expect(enable).toBeGreaterThanOrEqual(0);
      expect(draw).toBeGreaterThan(enable);
      expect(disable).toBeGreaterThan(draw);
      // Deleted while its VAO is still bound, which is what detaches it.
      expect(del).toBeGreaterThan(disable);
      expect(unbind).toBeGreaterThan(del);
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

  it('applies the clip test before its draw', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 1;
    dispatch(ctx, vColorStroke());

    const testIdx = calls.findIndex(
      (c) => c.name === 'stencilFunc'
        && c.args[0] === gl.EQUAL && c.args[1] === 0x02 && c.args[2] === 0x02,
    );
    const drawIdx = calls.findIndex((c) => c.name === 'drawElements');
    expect(testIdx).toBeGreaterThanOrEqual(0);
    expect(drawIdx).toBeGreaterThan(testIdx);
  });

  it('turns the stencil test off when nothing clips it', () => {
    // Without this the ribbon inherits whatever a previous clip left behind —
    // a popClip's EQUAL against a now-cleared bit discards the whole draw.
    const { ctx, calls, gl } = createRecorderCtx();
    dispatch(ctx, vColorStroke());
    const disableIdx = calls.findIndex(
      (c) => c.name === 'disable' && c.args[0] === gl.STENCIL_TEST,
    );
    const drawIdx = calls.findIndex((c) => c.name === 'drawElements');
    expect(disableIdx).toBeGreaterThanOrEqual(0);
    expect(drawIdx).toBeGreaterThan(disableIdx);
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
