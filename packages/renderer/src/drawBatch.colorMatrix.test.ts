/**
 * A group color matrix and the run.
 *
 * A solid's color is known on the CPU, so the matrix is applied there and the
 * rect stays in the run it would have broken. A texel's color is not, so a
 * gradient or an image under a matrix no vertex tint expresses names that
 * matrix by index, and the run draws under several at once. The recorder shows
 * the draw count, the staged colors, and the matrices uploaded;
 * `colorMatrixFold.browser.test.ts` shows that the routes paint the same pixel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { FLOATS_PER_VERTEX, TEX_SLOT_OFFSET } from './drawBatch';
import type { DrawCommand } from './DrawCommand';
import { colorFolding } from './draw';
import { BATCH_MATRIX_SLOTS, matrixOf } from './shaders/batchFill';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';

/** Offset of the color within a vertex: after the vec2 position. */
const COLOR = 2;

/** Halves every color channel and lifts red by a quarter. */
const TINTED = ((): number[] => {
  const cm = new Array<number>(20).fill(0);
  cm[0] = 0.5; cm[6] = 0.5; cm[12] = 0.5; cm[18] = 1;
  cm[4] = 0.25;
  return cm;
})();

/** `TINTED` with a red lift of `bias`, for matrices no two of which are equal. */
const lifted = (bias: number): number[] => {
  const cm = [...TINTED];
  cm[4] = bias;
  return cm;
};

describe('renderer — a group color matrix and the run', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;
  const atlas = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  const rect = (x: number, color = '#ff0000'): DrawCommand => ({
    kind: 'path', path: { kind: 'rect', x, y: 0, width: 10, height: 10 }, fill: { paint: { color } },
  });
  const img = (x: number): DrawCommand => ({ kind: 'image', image: atlas, x, y: 0, w: 16, h: 16 });
  const gradient = (x: number, opacity?: number): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x, y: 0, width: 10, height: 10 },
    fill: { paint: {
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, opacity,
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    } },
  } as DrawCommand);
  const group = (extra: object, children: DrawCommand[]): DrawCommand =>
    ({ kind: 'group', ...extra, children }) as DrawCommand;

  const draws = (): number[] =>
    recorder.calls.filter((c) => c.name === 'drawElements').map((c) => c.args[1] as number);

  /** The program bound at each `drawElements`, replayed from `useProgram`. */
  const drawPrograms = (): unknown[] => {
    const out: unknown[] = [];
    let live: unknown = null;
    for (const c of recorder.calls) {
      if (c.name === 'useProgram') live = c.args[0];
      else if (c.name === 'drawElements') out.push(live);
    }
    return out;
  };

  /**
   * What the batch program bound at each draw held, one value per matrix the
   * run draws under: `u_colorBias[i].r`, which is 0.25 under `TINTED` and 0
   * under identity, and `u_alpha[i]`. An upload the renderer skipped leaves
   * the previous one in force, as it does on the GPU. A run under one matrix
   * draws with `_batchFill`, one under more with `_batchVariants`, and
   * each holds its own.
   */
  const uniformsAtDraws = (): { bias: number[]; alpha: number[] }[] => {
    const programs = [r._batchFill(), r._batchVariants().get(true, false)];
    const held = new Map(programs.map((p) => [p.handle as unknown, { bias: [] as number[], alpha: [] as number[] }]));
    const owner = (loc: unknown, name: string) => programs.find((p) => p.uniform(name) === loc)?.handle;
    const out: { bias: number[]; alpha: number[] }[] = [];
    let bound: unknown = null;
    for (const c of recorder.calls) {
      if (c.name === 'useProgram') bound = c.args[0];
      const biasOf = c.name === 'uniform4fv' ? owner(c.args[0], 'u_colorBias') : undefined;
      if (biasOf !== undefined) {
        const data = c.args[1] as Float32Array;
        held.get(biasOf)!.bias = Array.from({ length: data.length / 4 }, (_, i) => data[4 * i]);
      }
      const alphaOf = c.name === 'uniform1fv' ? owner(c.args[0], 'u_alpha') : undefined;
      if (alphaOf !== undefined) held.get(alphaOf)!.alpha = Array.from(c.args[1] as Float32Array);
      if (c.name === 'drawElements') out.push({ ...held.get(bound)! });
    }
    return out;
  };
  const biasAtDraws = (): number[][] => uniformsAtDraws().map((u) => u.bias);

  /** The vertices of upload `n`, bounded by the length the call itself sent. */
  const upload = (n = 0): Float32Array => {
    const call = recorder.calls.filter(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )[n];
    return (call.args[2] as Float32Array).subarray(0, call.args[4] as number);
  };

  /** One value per quad of the first upload, read off its first vertex. */
  const perQuad = <T>(read: (verts: Float32Array, at: number) => T): T[] => {
    const verts = upload();
    const out: T[] = [];
    for (let i = 0; i < verts.length; i += 4 * FLOATS_PER_VERTEX) out.push(read(verts, i));
    return out;
  };
  const quadColors = (): number[][] =>
    perQuad((v, i) => Array.from(v.slice(i + COLOR, i + COLOR + 4)));
  /** The after-the-matrix alpha factor. */
  const quadPosts = (): number[] => perQuad((v, i) => v[i + 8]);
  /** Which of the run's matrices each quad names. */
  const quadMatrices = (): number[] => perQuad((v, i) => matrixOf(v[i + TEX_SLOT_OFFSET]));

  it('keeps a solid under a color matrix in the run, its color mapped on the CPU', () => {
    r.render([rect(0), group({ colorMatrix: TINTED }, [rect(20)]), rect(40)]);
    expect(draws()).toEqual([18]);
    expect(biasAtDraws()).toEqual([[0]]);
    expect(quadColors()).toEqual([[1, 0, 0, 1], [0.75, 0, 0, 1], [1, 0, 0, 1]]);
    expect(quadMatrices()).toEqual([0, 0, 0]);
  });

  it('clamps a mapped color the way the shader does', () => {
    const blown = [...TINTED];
    blown[4] = 0.75;
    r.render([group({ colorMatrix: blown }, [rect(0), rect(20, '#000000')])]);
    expect(quadColors()).toEqual([[1, 0, 0, 1], [0.75, 0, 0, 1]]);
  });

  it('applies group alpha after the matrix, as u_alpha did', () => {
    // Alpha row 0.5: the matrix halves alpha, and the group halves it again.
    const fading = [...TINTED];
    fading[18] = 0.5;
    r.render([group({ colorMatrix: fading }, [rect(0), group({ alpha: 0.5 }, [rect(20)])])]);
    expect(draws()).toEqual([12]);
    expect(quadColors()).toEqual([[0.75, 0, 0, 0.5], [0.75, 0, 0, 0.25]]);
  });

  it('keeps an image under a matrix the CPU cannot map in the run, naming the matrix', () => {
    r.render([img(0), group({ colorMatrix: TINTED }, [img(20)]), img(40)]);
    expect(draws()).toEqual([18]);
    // Identity joined first, then the group's; the third quad is back on the first.
    expect(quadMatrices()).toEqual([0, 1, 0]);
    expect(biasAtDraws()).toEqual([[0, 0.25]]);
    // The shader maps it, so the vertex carries no tint.
    expect(quadColors()).toEqual([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]);
  });

  it('uploads each matrix column-major beside its bias', () => {
    // Red and blue both read blue, and green is lifted by a half.
    const swap = new Array<number>(20).fill(0);
    swap[2] = 1; swap[6] = 1; swap[12] = 1; swap[18] = 1; swap[9] = 0.5;
    r.render([group({ colorMatrix: swap }, [img(0)])]);
    // One matrix in the run, so the program that indexes entry 0 draws it.
    expect(drawPrograms()).toEqual([r._batchFill().handle]);
    const uMatrix = r._batchFill().uniform('u_colorMatrix');
    const sent = recorder.calls.find((c) => c.name === 'uniformMatrix4fv' && c.args[0] === uMatrix)!;
    const m = Array.from(sent.args[2] as Float32Array);
    expect(m).toHaveLength(16);
    // Column 2 feeds rows 0 and 2; column 0 feeds none.
    expect(m.slice(8, 12)).toEqual([1, 0, 1, 0]);
    expect(m.slice(0, 4)).toEqual([0, 0, 0, 0]);
    const uBias = r._batchFill().uniform('u_colorBias');
    const bias = recorder.calls.find((c) => c.name === 'uniform4fv' && c.args[0] === uBias)!;
    expect(Array.from(bias.args[1] as Float32Array)).toEqual([0, 0.5, 0, 0]);
  });

  /** Scales red by a half and green by a quarter, and halves alpha: no bias, nothing off the diagonal. */
  const SCALED = ((): number[] => {
    const cm = new Array<number>(20).fill(0);
    cm[0] = 0.5; cm[6] = 0.25; cm[12] = 1; cm[18] = 0.5;
    return cm;
  })();

  it('keeps an image under a matrix that only scales channels down in the run, as a vertex tint', () => {
    r.render([img(0), group({ colorMatrix: SCALED, alpha: 0.5 }, [img(20)]), img(40)]);
    expect(draws()).toEqual([18]);
    expect(quadColors()).toEqual([[1, 1, 1, 1], [0.5, 0.25, 1, 1], [1, 1, 1, 1]]);
    // The matrix's alpha scale and the group's alpha both ride the vertex.
    expect(quadPosts()).toEqual([1, 0.25, 1]);
    expect(quadMatrices()).toEqual([0, 0, 0]);
    expect(biasAtDraws()).toEqual([[0]]);
  });

  it('tints packed sprites the same way', () => {
    const sprites = new Float32Array([0, 0, 16, 16, 0, 0, 16, 16, 1]);
    r.render([img(0), group({ colorMatrix: SCALED }, [{ kind: 'sprites', image: atlas, sprites }])]);
    expect(draws()).toEqual([12]);
    expect(quadColors()[1]).toEqual([0.5, 0.25, 1, 1]);
    expect(quadPosts()[1]).toEqual(0.5);
  });

  it('leaves a scale past 1 to the shader, which clamps after the texel', () => {
    const bright = [...SCALED];
    bright[0] = 2;
    r.render([img(0), group({ colorMatrix: bright }, [img(20)]), img(40)]);
    expect(draws()).toEqual([18]);
    expect(quadColors()).toEqual([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]);
    expect(quadMatrices()).toEqual([0, 1, 0]);
  });

  it('carries group alpha on an image vertex under a matrix, so alpha breaks nothing', () => {
    // `a = clamp(CM * src + bias).a * u_alpha[i] * a_post`: the factor after
    // the matrix is the vertex's, so two alphas share one entry.
    r.render([group({ colorMatrix: TINTED }, [img(0), group({ alpha: 0.5 }, [img(20)])])]);
    expect(draws()).toEqual([12]);
    expect(quadPosts()).toEqual([1, 0.5]);
    expect(quadMatrices()).toEqual([0, 0]);
    expect(uniformsAtDraws()).toEqual([{ bias: [0.25], alpha: [1] }]);
  });

  it('maps a solid on the CPU in a run an image opened under the same matrix', () => {
    r.render([group({ colorMatrix: TINTED }, [img(0), rect(20)])]);
    expect(draws()).toEqual([12]);
    expect(biasAtDraws()).toEqual([[0.25, 0]]);
    expect(quadMatrices()).toEqual([0, 1]);
    expect(quadColors()[1]).toEqual([0.75, 0, 0, 1]);
  });

  it('keeps solids and images under two different matrices in one run', () => {
    r.render([
      rect(0),
      group({ colorMatrix: TINTED }, [rect(20), img(40)]),
      group({ colorMatrix: lifted(0.125) }, [img(60), rect(80)]),
    ]);
    expect(draws()).toEqual([30]);
    expect(biasAtDraws()).toEqual([[0, 0.25, 0.125]]);
    expect(quadMatrices()).toEqual([0, 0, 1, 2, 0]);
    expect(drawPrograms()).toEqual([r._batchVariants().get(true, false).handle]);
    // The last rect is mapped by the second matrix: red 0.5 + 0.125.
    expect(quadColors()[4]).toEqual([0.625, 0, 0, 1]);
  });

  describe('a gradient, whose texel the CPU cannot map either', () => {
    it('joins the run under a matrix, naming it, with group alpha in its entry', () => {
      r.render([rect(0), group({ colorMatrix: TINTED, alpha: 0.5 }, [gradient(20, 0.5)]), rect(40)]);
      expect(draws()).toEqual([18]);
      expect(quadMatrices()).toEqual([0, 1, 0]);
      expect(uniformsAtDraws()).toEqual([{ bias: [0, 0.25], alpha: [1, 0.5] }]);
      // Its own opacity goes through the matrix, so it stays on the vertex,
      // and the group's alpha does not join it there.
      expect(quadColors()[1]).toEqual([1, 1, 1, 0.5]);
    });

    it('gives a second group alpha under one matrix an entry of its own', () => {
      // A radial gradient's a_post is its atlas row, so alpha after the matrix
      // has no room on the vertex and is the entry's.
      r.render([group({ colorMatrix: TINTED }, [gradient(0), group({ alpha: 0.5 }, [gradient(20)])])]);
      expect(draws()).toEqual([12]);
      expect(quadMatrices()).toEqual([0, 1]);
      expect(uniformsAtDraws()).toEqual([{ bias: [0.25, 0.25], alpha: [1, 0.5] }]);
    });

    it('takes a matrix that only scales channels down as a vertex tint', () => {
      r.render([rect(0), group({ colorMatrix: SCALED, alpha: 0.5 }, [gradient(20)])]);
      expect(draws()).toEqual([12]);
      expect(quadMatrices()).toEqual([0, 0]);
      expect(quadColors()[1]).toEqual([0.5, 0.25, 1, 0.25]);
      expect(biasAtDraws()).toEqual([[0]]);
    });
  });

  it('breaks the run at one matrix more than it has entries for', () => {
    // Each image under a matrix of its own; the run holds BATCH_MATRIX_SLOTS.
    const under = (i: number): DrawCommand => group({ colorMatrix: lifted((i + 1) / 32) }, [img(i * 20)]);
    r.render(Array.from({ length: BATCH_MATRIX_SLOTS + 1 }, (_, i) => under(i)));
    expect(draws()).toEqual([BATCH_MATRIX_SLOTS * 6, 6]);
    expect(quadMatrices()).toEqual(Array.from({ length: BATCH_MATRIX_SLOTS }, (_, i) => i));
    // The second run starts its own list.
    const second = upload(1);
    expect(matrixOf(second[TEX_SLOT_OFFSET])).toBe(0);
    expect(biasAtDraws()[1]).toEqual([(BATCH_MATRIX_SLOTS + 1) / 32]);
  });

  it('does not upload again for a run whose matrices the program already holds', () => {
    // Two runs, broken by a clip only the stencil expresses, under one matrix.
    /** Notched, so not convex: only the stencil expresses it. */
    const diamond = {
      kind: 'polygon', commands: new Uint8Array([M, L, L, L, L, Z]),
      coords: new Float32Array([5, 0, 10, 5, 5, 10, 5, 6, 0, 5]), fillRule: 'nonzero',
    };
    r.render([
      group({ colorMatrix: TINTED }, [img(0)]),
      group({ clip: diamond, colorMatrix: TINTED }, [img(0)]),
    ]);
    const runs = recorder.calls.filter(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    );
    expect(runs).toHaveLength(2);
    const uBias = r._batchFill().uniform('u_colorBias');
    expect(recorder.calls.filter((c) => c.name === 'uniform4fv' && c.args[0] === uBias)).toHaveLength(1);
  });

  it('breaks on a matrix as it used to with folding off, which the perf specs rely on', () => {
    colorFolding.enabled = false;
    try {
      r.render([rect(0), group({ colorMatrix: TINTED }, [rect(20)]), rect(40)]);
    } finally {
      colorFolding.enabled = true;
    }
    expect(draws()).toEqual([6, 6, 6]);
    expect(biasAtDraws()).toEqual([[0], [0.25], [0]]);
    // Unmapped: the shader does it.
    expect(Array.from(upload(1).slice(COLOR, COLOR + 4))).toEqual([1, 0, 0, 1]);
  });
});
