/**
 * A group color matrix and the run.
 *
 * A solid's color is known on the CPU, so the matrix is applied there and the
 * rect stays in the run it would have broken. A textured quad's color is not,
 * so it still draws under the matrix as a uniform. The recorder shows the draw
 * count and the staged colors; `colorMatrixFold.browser.test.ts` shows that
 * the two routes paint the same pixel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { FLOATS_PER_VERTEX } from './drawBatch';
import type { DrawCommand } from './DrawCommand';
import { colorFolding } from './draw';

/** Offset of the color within a vertex: after the vec2 position. */
const COLOR = 2;

/** Halves every color channel and lifts red by a quarter. */
const TINTED = ((): number[] => {
  const cm = new Array<number>(20).fill(0);
  cm[0] = 0.5; cm[6] = 0.5; cm[12] = 0.5; cm[18] = 1;
  cm[4] = 0.25;
  return cm;
})();

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
    kind: 'path', path: { kind: 'rect', x, y: 0, width: 10, height: 10 }, fill: { color },
  });
  const img = (x: number): DrawCommand => ({ kind: 'image', image: atlas, x, y: 0, w: 16, h: 16 });
  const group = (extra: object, children: DrawCommand[]): DrawCommand =>
    ({ kind: 'group', ...extra, children }) as DrawCommand;

  const draws = (): number[] =>
    recorder.calls.filter((c) => c.name === 'drawElements').map((c) => c.args[1] as number);

  /** `u_colorBias.r` in force at each draw: 0.25 under `TINTED`, 0 under identity. */
  const biasAtDraws = (): number[] => {
    const uBias = r._batchFill().uniform('u_colorBias');
    const out: number[] = [];
    let pending = 0;
    for (const c of recorder.calls) {
      if (c.name === 'uniform4f' && c.args[0] === uBias) pending = c.args[1] as number;
      if (c.name === 'drawElements') out.push(pending);
    }
    return out;
  };

  /** The color of the first vertex of each quad in the first upload. */
  const quadColors = (): number[][] => {
    const upload = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!;
    const verts = upload.args[2] as Float32Array;
    const floats = upload.args[4] as number;
    const out: number[][] = [];
    for (let i = 0; i < floats; i += 4 * FLOATS_PER_VERTEX) {
      out.push(Array.from(verts.slice(i + COLOR, i + COLOR + 4)));
    }
    return out;
  };

  it('keeps a solid under a color matrix in the run, its color mapped on the CPU', () => {
    r.render([rect(0), group({ colorMatrix: TINTED }, [rect(20)]), rect(40)]);
    expect(draws()).toEqual([18]);
    expect(biasAtDraws()).toEqual([0]);
    expect(quadColors()).toEqual([[1, 0, 0, 1], [0.75, 0, 0, 1], [1, 0, 0, 1]]);
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

  it('still breaks for an image, whose color the CPU cannot map', () => {
    r.render([img(0), group({ colorMatrix: TINTED }, [img(20)]), img(40)]);
    expect(draws()).toEqual([6, 6, 6]);
    // The group's run is still staged when the group pops. What breaks it is
    // the image that follows, by which point the matrix is off the stack: the
    // flush has to draw under the state the run was staged in, not the live one.
    expect(biasAtDraws()).toEqual([0, 0.25, 0]);
  });

  it('keeps alpha a uniform, and a barrier, in a run drawn under a matrix', () => {
    // `a = clamp(CM * src + bias).a * u_alpha`: with a real matrix between
    // them, an alpha multiplied onto an image vertex is a different number.
    r.render([group({ colorMatrix: TINTED }, [img(0), group({ alpha: 0.5 }, [img(20)])])]);
    expect(draws()).toEqual([6, 6]);
    const uAlpha = r._batchFill().uniform('u_alpha');
    const sent = recorder.calls
      .filter((c) => c.name === 'uniform1f' && c.args[0] === uAlpha)
      .map((c) => c.args[1]);
    expect(sent).toEqual([1, 0.5]);
  });

  it('lets a solid join a run an image opened under the same matrix, unmapped', () => {
    r.render([group({ colorMatrix: TINTED }, [img(0), rect(20)])]);
    expect(draws()).toEqual([12]);
    expect(biasAtDraws()).toEqual([0.25]);
    // The shader maps it, so the vertex carries the color as authored.
    expect(quadColors()[1]).toEqual([1, 0, 0, 1]);
  });

  it('breaks once when an image follows a mapped solid in its group', () => {
    r.render([rect(0), group({ colorMatrix: TINTED }, [rect(20), img(40)])]);
    expect(draws()).toEqual([12, 6]);
    expect(biasAtDraws()).toEqual([0, 0.25]);
  });

  it('breaks a solid out of a run drawn under a different matrix', () => {
    const other = [...TINTED];
    other[4] = 0.125;
    r.render([group({ colorMatrix: TINTED }, [img(0)]), group({ colorMatrix: other }, [rect(20)])]);
    expect(draws()).toEqual([6, 6]);
    expect(biasAtDraws()).toEqual([0.25, 0]);
    // The second run is its own, so the rect is mapped by `other`: red 0.5 + 0.125.
    const uploads = recorder.calls.filter(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    );
    const second = uploads[1].args[2] as Float32Array;
    expect(Array.from(second.slice(COLOR, COLOR + 4))).toEqual([0.625, 0, 0, 1]);
  });

  it('breaks on a matrix as it used to with folding off, which the perf specs rely on', () => {
    colorFolding.enabled = false;
    try {
      r.render([rect(0), group({ colorMatrix: TINTED }, [rect(20)]), rect(40)]);
    } finally {
      colorFolding.enabled = true;
    }
    expect(draws()).toEqual([6, 6, 6]);
    expect(biasAtDraws()).toEqual([0, 0.25, 0]);
  });
});
