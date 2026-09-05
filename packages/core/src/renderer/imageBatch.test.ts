/**
 * What merges into one image draw, and what breaks the run.
 *
 * Painter's order is the whole contract, and a missing flush never throws — it
 * paints in the wrong order, or paints under state that moved. So most of this
 * file is about the breaks rather than the merge: the merge is one test, and
 * every other one is a way of getting it wrong silently.
 *
 * The counterpart to `solidBatch.test.ts`, and deliberately a separate file:
 * that one's buffer-replay helpers assume nothing else writes
 * `bufferSubData(ARRAY_BUFFER)` in the frames it renders.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { IMAGE_RING_SIZE, MAX_IMAGE_VERTICES_PER_BATCH } from './imageBatch';
import type { DrawCommand } from './DrawCommand';

describe('renderer — consecutive image batching', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  const bitmap = (width = 16, height = 16) =>
    ({ width, height, close: () => {} }) as unknown as ImageBitmap;

  let atlas: ImageBitmap;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    atlas = bitmap();
    recorder.reset();
  });

  const img = (x: number, extra: Partial<DrawCommand & { kind: 'image' }> = {}) => ({
    kind: 'image' as const, image: atlas, x, y: 0, w: 16, h: 16, ...extra,
  });

  const rect = (x: number) => ({
    kind: 'path' as const,
    path: { kind: 'rect' as const, x, y: 0, width: 16, height: 16 },
    fill: { color: '#f00' },
  });

  /** Index count of every `drawElements`, in order. */
  const draws = () =>
    recorder.calls.filter((c) => c.name === 'drawElements').map((c) => c.args[1] as number);

  /** The program bound at each `drawElements`, replayed from `useProgram`. */
  function drawPrograms(): unknown[] {
    const out: unknown[] = [];
    let live: unknown = null;
    for (const c of recorder.calls) {
      if (c.name === 'useProgram') live = c.args[0];
      else if (c.name === 'drawElements') out.push(live);
    }
    return out;
  }

  /** Each vertex upload the image batch made, trimmed to the live prefix — the
   *  staging array is sized past the run and uploaded from offset 0. */
  function quadUploads(): Float32Array[] {
    return recorder.calls
      .filter((c) => c.name === 'bufferSubData' && c.args[2] instanceof Float32Array)
      .map((c) => (c.args[2] as Float32Array).subarray(0, c.args[4] as number))
      .filter((v) => v.length >= 20 && v.length % 20 === 0);
  }

  /** Every value written to `u_alpha` on the batch program. */
  function alphaWrites(): number[] {
    const loc = r._imageFillVOpacity().uniform('u_alpha');
    return recorder.calls
      .filter((c) => c.name === 'uniform1f' && c.args[0] === loc)
      .map((c) => c.args[1] as number);
  }

  it('merges a run of quads over one bitmap into a single draw', () => {
    r.render([img(0), img(20), img(40)]);
    expect(draws()).toEqual([18]);
    expect(drawPrograms()).toEqual([r._imageFillVOpacity().handle]);
  });

  it('does not merge across bitmaps — a batch samples one texture', () => {
    const other = bitmap();
    r.render([img(0), { ...img(20), image: other }, img(40)]);
    expect(draws()).toEqual([6, 6, 6]);
  });

  it('folds per-command opacity into the vertices rather than breaking the run', () => {
    r.render([img(0, { opacity: 0.25 }), img(20, { opacity: 0.75 })]);
    expect(draws()).toEqual([12]);
    const v = quadUploads()[0];
    // Opacity is the fifth float of each vertex.
    expect([v[4], v[9], v[14], v[19]]).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect([v[24], v[29], v[34], v[39]]).toEqual([0.75, 0.75, 0.75, 0.75]);
  });

  it('folds group alpha into the same attribute and leaves u_alpha at 1', () => {
    // The rect forces the flush to happen *inside* the group, while alpha is
    // still 0.5. Flushing after it pops would read 1 off the live state and
    // hide a second application of it — the subtlest bug this design has.
    r.render([{
      kind: 'group', alpha: 0.5,
      children: [img(0), img(20), rect(40)],
    }]);
    expect(draws()).toEqual([12, 6]);
    expect(quadUploads()[0][4]).toBeCloseTo(0.5);
    // Applying it here too would square it.
    expect(alphaWrites()).toEqual([1]);
  });

  it('multiplies command opacity by group alpha', () => {
    r.render([{
      kind: 'group', alpha: 0.5,
      children: [img(0, { opacity: 0.5 })],
    }]);
    expect(quadUploads()[0][4]).toBeCloseTo(0.25);
  });

  it('merges across a group transform, placing the corners itself', () => {
    r.render([
      img(0),
      { kind: 'group', transform: new Float32Array([1, 0, 0, 0, 1, 0, 40, 30, 1]), children: [img(0)] },
      img(0),
    ]);
    expect(draws()).toEqual([18]);
    const v = quadUploads()[0];
    // Second quad's top-left corner carries the group's translation; its
    // neighbours in the same buffer do not.
    expect([v[0], v[1]]).toEqual([0, 0]);
    expect([v[20], v[21]]).toEqual([40, 30]);
    expect([v[40], v[41]]).toEqual([0, 0]);
  });

  it('does not merge across a sampling change — MAG_FILTER is texture state', () => {
    // Warm the texture first: `upload` sets MAG_FILTER once at creation, and
    // this is about the filter each *flush* sets.
    r.render([img(0)]);
    recorder.reset();

    r.render([img(0, { sampling: 'nearest' }), img(20)]);
    expect(draws()).toEqual([6, 6]);
    const magFilters = recorder.calls
      .filter((c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER)
      .map((c) => c.args[2]);
    expect(magFilters).toEqual([recorder.gl.NEAREST, recorder.gl.LINEAR]);
  });

  it('does not merge across a group color matrix', () => {
    const tinted = [1, 0, 0, 0, 0.25, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    r.render([
      img(0),
      { kind: 'group', colorMatrix: tinted, children: [img(20)] },
      img(40),
    ]);
    expect(draws()).toEqual([6, 6, 6]);
  });

  it('flushes the run before a clip is pushed and before it is popped', () => {
    r.render([
      img(0),
      {
        kind: 'group',
        clip: { kind: 'rect', x: 0, y: 0, width: 100, height: 100 },
        children: [img(20)],
      },
      img(40),
    ]);
    // Replayed: the clipped quad's draw must fall while STENCIL_TEST is on.
    // Keyed on the program, not the index count — rasterizing the clip path
    // into the stencil is itself a six-index draw.
    const batchProg = r._imageFillVOpacity().handle;
    let stencil = false;
    let prog: unknown = null;
    const stencilAtDraw: boolean[] = [];
    for (const c of recorder.calls) {
      if (c.name === 'enable' && c.args[0] === recorder.gl.STENCIL_TEST) stencil = true;
      else if (c.name === 'disable' && c.args[0] === recorder.gl.STENCIL_TEST) stencil = false;
      else if (c.name === 'useProgram') prog = c.args[0];
      else if (c.name === 'drawElements' && prog === batchProg) stencilAtDraw.push(stencil);
    }
    expect(stencilAtDraw).toEqual([false, true, false]);
  });

  it('keeps painter’s order across the solid and image batches', () => {
    const vColor = r._pathFillVColor().handle;
    const vOpacity = r._imageFillVOpacity().handle;
    r.render([img(0), rect(20), img(40)]);
    expect(drawPrograms()).toEqual([vOpacity, vColor, vOpacity]);

    // Both directions, because they are separate flushes: staging an image
    // drains the solid run, and staging a solid drains the image run. With
    // only the second, this order comes out image-first.
    recorder.reset();
    r.render([rect(0), img(20), rect(40)]);
    expect(drawPrograms()).toEqual([vColor, vOpacity, vColor]);
  });

  it('flushes before text, so a sprite behind a label stays behind it', () => {
    const text = {
      kind: 'text', x: 0, y: 0, runs: [], maxWidth: Infinity, align: 'left', style: {},
    } as unknown as DrawCommand;
    r.render([img(0), text, img(20)]);
    expect(draws()).toEqual([6, 6]);
  });

  it('chunks a run past the per-flush vertex cap', () => {
    const cap = MAX_IMAGE_VERTICES_PER_BATCH / 4;
    r.render(Array.from({ length: cap + 1 }, (_, i) => img(i % 700)));
    expect(draws()).toEqual([cap * 6, 6]);
  });

  it('never re-uploads a slot’s indices, whatever the quad count', () => {
    const indexWrites = () => recorder.calls.filter(
      (c) => (c.name === 'bufferSubData' || c.name === 'bufferData')
        && c.args[0] === recorder.gl.ELEMENT_ARRAY_BUFFER,
    ).length;
    // A full turn at each run length below, so every slot those take exists
    // and already holds its pattern.
    for (let i = 0; i <= IMAGE_RING_SIZE; i++) {
      r.render([img(0)]);
      r.render([img(0), img(20)]);
      r.render([img(0), img(20), img(40)]);
    }
    recorder.reset();

    // The pattern for N quads is a prefix of the pattern for any larger N, so
    // a run of a different length still draws from what the slot already has.
    r.render([img(0)]);
    r.render([img(0), img(20), img(40)]);
    expect(indexWrites()).toBe(0);
  });
});
