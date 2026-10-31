/**
 * What merges into one image draw, and what breaks the run. A missing flush
 * never throws — it paints in the wrong order, or paints under state that
 * moved.
 *
 * Deliberately a separate file from `drawBatch.test.ts`: that one's
 * buffer-replay helpers assume nothing else writes
 * `bufferSubData(ARRAY_BUFFER)` in the frames it renders.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { registerOwnDrawPaint, ownDrawRect } from './testing/ownDrawPaint';
import { SOLID_RING_SIZE, MAX_VERTICES_PER_BATCH, FLOATS_PER_VERTEX } from './drawBatch';
import { BATCH_TEXTURE_SLOTS, RAMP_SLOT, PAINT_MODE_IMAGE, PAINT_MODE_PLAIN, paintModeOf } from './shaders/batchFill';
import type { DrawCommand } from './DrawCommand';
import { PATH_M as M, PATH_L as L, PATH_Z as Z, type PolygonPath } from '@weasel-js/geom';

/** A square notched at its bottom edge: not convex, so no CPU cut can stand
 *  in for it, and the clip goes through the stencil. */
const squareClip = (size: number): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, L, Z]),
  coords: new Float32Array([0, 0, size, 0, size, size, size / 2, size / 2, 0, size]),
  fillRule: 'nonzero',
});
import { SPRITE_STRIDE } from './DrawCommand';

/** `drawBatch.ts`'s vertex: vec2 position, vec4 color, vec2 uv, float post,
 *  float texSlot. */
const FLOATS_PER_QUAD = FLOATS_PER_VERTEX * 4;
/** Offsets within a vertex. */
const UV = 6;
const POST = 8;
const SLOT = 9;

describe('renderer — consecutive image batching', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  const bitmap = (width = 16, height = 16) =>
    ({ width, height, close: () => {} }) as unknown as ImageBitmap;

  let atlas: ImageBitmap;

  let unregister: () => void;
  afterEach(() => unregister());
  beforeEach(() => {
    unregister = registerOwnDrawPaint();
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
    fill: { paint: { color: '#f00' } },
  });

  /** A fill the run cannot express, for tests that need a break they choose. */
  const breakerRect = (x: number): DrawCommand => ownDrawRect(x, 0, 16);

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

  /** Each vertex upload the batch made, trimmed to the live prefix — the
   *  staging array is sized past the run and uploaded from offset 0. */
  function quadUploads(): Float32Array[] {
    return recorder.calls
      .filter((c) => c.name === 'bufferSubData' && c.args[2] instanceof Float32Array)
      .map((c) => (c.args[2] as Float32Array).subarray(0, c.args[4] as number))
      .filter((v) => v.length >= FLOATS_PER_QUAD && v.length % FLOATS_PER_QUAD === 0);
  }

  /** The floats of quad `q` in an upload. */
  const imageQuadOf = (v: Float32Array, q: number) =>
    v.subarray(q * FLOATS_PER_QUAD, (q + 1) * FLOATS_PER_QUAD);

  /** Every value written to `u_alpha` on the batch program, one per matrix a run draws under. */
  function alphaWrites(): number[] {
    const loc = r._batchFill().uniform('u_alpha');
    return recorder.calls
      .filter((c) => c.name === 'uniform1fv' && c.args[0] === loc)
      .flatMap((c) => Array.from(c.args[1] as Float32Array));
  }

  it('merges a run of quads over one bitmap into a single draw', () => {
    r.render([img(0), img(20), img(40)]);
    expect(draws()).toEqual([18]);
    expect(drawPrograms()).toEqual([r._batchFill().handle]);
  });

  it('merges across bitmaps, each quad naming its own texture slot', () => {
    const other = bitmap();
    r.render([img(0), { ...img(20), image: other }, img(40)]);
    // One draw over three quads, not one per bitmap change.
    expect(draws()).toEqual([18]);
    const v = quadUploads()[0];
    const slot = (vertex: number) => v[vertex * FLOATS_PER_VERTEX + SLOT] % BATCH_TEXTURE_SLOTS;
    // Slot 0 is the white texel, so the first bitmap is 1 and the second 2 —
    // and the third quad returns to the first bitmap's slot rather than taking
    // a third.
    expect([slot(0), slot(4), slot(8)]).toEqual([1, 2, 1]);
  });

  it('marks an image vertex with the image paint mode, which a solid in its run does not carry', () => {
    r.render([rect(40), img(0)]);
    const v = quadUploads()[0];
    const mode = (vertex: number) => paintModeOf(v[vertex * FLOATS_PER_VERTEX + SLOT]);
    expect([mode(0), mode(4)]).toEqual([PAINT_MODE_PLAIN, PAINT_MODE_IMAGE]);
  });

  it('binds the white texel at slot 0 and each bitmap above it', () => {
    const other = bitmap();
    r.render([img(0), { ...img(20), image: other }]);
    const units = recorder.calls
      .filter((c) => c.name === 'activeTexture')
      .map((c) => (c.args[0] as number) - recorder.gl.TEXTURE0);
    // Unit 0 for white, then one per bitmap, then back to 0 for whoever draws
    // next — a bind left on a high unit is one the next program never samples.
    expect(units).toEqual([0, 1, 2, 0]);
  });

  it('keeps eight bitmaps in one run, which seven slots could not', () => {
    const sheets = Array.from({ length: 8 }, () => bitmap());
    r.render(sheets.map((image, i) => ({ ...img(i * 20), image })));
    expect(draws()).toEqual([48]);
    // Each quad names a slot of its own, past the white texel at 0.
    const v = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    const slots = sheets.map((_, i) => v[i * FLOATS_PER_QUAD + SLOT] % BATCH_TEXTURE_SLOTS);
    expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('breaks the run when every texture slot is taken', () => {
    // One more bitmap than the run has slots for. `BATCH_TEXTURE_SLOTS`
    // includes the white texel, so the run holds one fewer bitmap than that.
    const sheets = Array.from({ length: BATCH_TEXTURE_SLOTS }, () => bitmap());
    r.render(sheets.map((image, i) => ({ ...img(i * 20), image })));
    // The first slots-minus-one fill the run; the last opens a second.
    expect(draws()).toEqual([(BATCH_TEXTURE_SLOTS - 1) * 6, 6]);
  });

  describe('the ramp atlas, which always takes the last slot', () => {
    const linear = (x: number) => ({
      kind: 'path' as const,
      path: { kind: 'rect' as const, x, y: 0, width: 16, height: 16 },
      fill: { paint: {
        kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 16, y: 0 },
        stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      } },
    }) as DrawCommand;
    const sheets = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...img(40 + i * 20), image: bitmap() }));

    // The run holds one texture fewer than BATCH_TEXTURE_SLOTS whichever of
    // them is the ramp atlas, and whenever it joins.
    it('shares a run with all but one of the other slots, joining first', () => {
      r.render([linear(0), ...sheets(BATCH_TEXTURE_SLOTS - 2)]);
      expect(draws()).toEqual([(BATCH_TEXTURE_SLOTS - 1) * 6]);
    });

    it('shares a run with all but one of the other slots, joining last', () => {
      r.render([...sheets(BATCH_TEXTURE_SLOTS - 2), linear(0)]);
      expect(draws()).toEqual([(BATCH_TEXTURE_SLOTS - 1) * 6]);
    });

    it('breaks the run at one texture more, joining first', () => {
      r.render([linear(0), ...sheets(BATCH_TEXTURE_SLOTS - 1)]);
      expect(draws()).toEqual([(BATCH_TEXTURE_SLOTS - 1) * 6, 6]);
    });

    it('breaks the run at one texture more, joining last', () => {
      r.render([...sheets(BATCH_TEXTURE_SLOTS - 1), linear(0)]);
      expect(draws()).toEqual([(BATCH_TEXTURE_SLOTS - 1) * 6, 6]);
    });

    it('binds the atlas at its slot, with the bitmaps below it', () => {
      r.render([linear(0), img(20)]);
      const units = recorder.calls
        .filter((c) => c.name === 'activeTexture')
        .map((c) => (c.args[0] as number) - recorder.gl.TEXTURE0);
      expect(units).toEqual([0, 1, RAMP_SLOT, 0]);
      const v = quadUploads()[0];
      const slot = (vertex: number) => v[vertex * FLOATS_PER_VERTEX + SLOT] % BATCH_TEXTURE_SLOTS;
      expect([slot(0), slot(4)]).toEqual([RAMP_SLOT, 1]);
    });
  });

  it('folds per-command opacity into the vertices rather than breaking the run', () => {
    r.render([img(0, { opacity: 0.25 }), img(20, { opacity: 0.75 })]);
    expect(draws()).toEqual([12]);
    const v = quadUploads()[0];
    const post = (vertex: number) => v[vertex * FLOATS_PER_VERTEX + POST];
    expect([post(0), post(1), post(2), post(3)]).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect([post(4), post(5), post(6), post(7)]).toEqual([0.75, 0.75, 0.75, 0.75]);
  });

  it('folds group alpha into the same attribute and leaves u_alpha at 1', () => {
    // The vertex-colored fill forces the flush to happen *inside* the group,
    // while alpha is still 0.5. Flushing after it pops would read 1 off the
    // live state and hide a second application of it. A solid rect will not
    // do it: it joins the run.
    r.render([{
      kind: 'group', alpha: 0.5,
      children: [img(0), img(20), breakerRect(40)],
    }]);
    expect(draws()).toEqual([12, 6]);
    expect(quadUploads()[0][POST]).toBeCloseTo(0.5);
    // Applying it here too would square it.
    expect(alphaWrites()).toEqual([1]);
  });

  it('multiplies command opacity by group alpha', () => {
    r.render([{
      kind: 'group', alpha: 0.5,
      children: [img(0, { opacity: 0.5 })],
    }]);
    expect(quadUploads()[0][POST]).toBeCloseTo(0.25);
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
    const corner = (vertex: number) =>
      [v[vertex * FLOATS_PER_VERTEX], v[vertex * FLOATS_PER_VERTEX + 1]];
    expect(corner(0)).toEqual([0, 0]);
    expect(corner(4)).toEqual([40, 30]);
    expect(corner(8)).toEqual([0, 0]);
  });

  it('cuts a quad to a rect clip with its UVs, in the same run as what surrounds it', () => {
    r.render([
      rect(40),
      { kind: 'group', clip: { kind: 'rect', x: 0, y: 4, width: 8, height: 100 }, children: [img(0)] },
    ] as DrawCommand[]);
    expect(draws()).toEqual([12]);
    const call = recorder.calls.find((c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER)!;
    const verts = call.args[2] as Float32Array;
    const quad: number[][] = [];
    for (let v = 4; v < 8; v++) {
      const at = v * FLOATS_PER_VERTEX;
      quad.push([verts[at], verts[at + 1], verts[at + UV], verts[at + UV + 1]]);
    }
    // x 0..8 of a 16-wide quad is u 0..0.5; y 4..16 of 16 is v 0.25..1.
    expect(quad).toEqual([[0, 4, 0, 0.25], [8, 4, 0.5, 0.25], [8, 16, 0.5, 1], [0, 16, 0, 1]]);
  });

  it('flushes the run before a stencil clip is pushed and before it is popped', () => {
    r.render([
      img(0),
      {
        kind: 'group',
        clip: squareClip(100),
        children: [img(20)],
      },
      img(40),
    ]);
    // Replayed: the clipped quad's draw must fall while STENCIL_TEST is on.
    // Keyed on the program, not the index count — rasterizing the clip path
    // into the stencil is itself a six-index draw.
    const batchProg = r._batchFill().handle;
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

  it('takes a solid rect into the run and keeps painter’s order', () => {
    // The wall's shape: a ground rect under an atlas quad, per cell. One draw,
    // and order held by the index stream — GL rasterizes a draw's primitives
    // in index order, so a quad staged later lands on top.
    //
    // Read off the vertex colors: an image quad carries white, this rect red.
    const colorRun = (v: Float32Array): string[] => {
      const out: string[] = [];
      for (let q = 0; q < v.length / FLOATS_PER_QUAD; q++) {
        const at = q * FLOATS_PER_QUAD;
        out.push(`${v[at + 2]},${v[at + 3]},${v[at + 4]}`);
      }
      return out;
    };
    r.render([img(0), rect(20), img(40)]);
    expect(draws()).toEqual([18]);
    expect(colorRun(quadUploads()[0])).toEqual(['1,1,1', '1,0,0', '1,1,1']);

    recorder.reset();
    r.render([rect(0), img(20), rect(40)]);
    expect(draws()).toEqual([18]);
    expect(colorRun(quadUploads()[0])).toEqual(['1,0,0', '1,1,1', '1,0,0']);
  });

  describe('kind: sprites — the same run, handed over packed', () => {
    /** `n` sprites over one 16x16 bitmap, each sampling a 4px cell. */
    const packed = (n: number, opacity = 1) => {
      const out = new Float32Array(n * SPRITE_STRIDE);
      for (let i = 0; i < n; i++) {
        out.set([i * 20, 0, 16, 16, (i % 4) * 4, 0, 4, 4, opacity], i * SPRITE_STRIDE);
      }
      return out;
    };

    const sprites = (s: Float32Array, extra = {}) =>
      ({ kind: 'sprites' as const, image: atlas, sprites: s, ...extra }) as unknown as DrawCommand;

    it('draws the whole run in one call', () => {
      r.render([sprites(packed(500))]);
      expect(draws()).toEqual([3000]);
      expect(drawPrograms()).toEqual([r._batchFill().handle]);
    });

    it('normalizes the source rect by the bitmap dimensions', () => {
      r.render([sprites(packed(1))]);
      const v = imageQuadOf(quadUploads()[0], 0);
      // First cell of a 16x16 bitmap: 0..4 px is 0..0.25 in UV.
      expect([v[UV], v[UV + 1], v[2 * FLOATS_PER_VERTEX + UV], v[2 * FLOATS_PER_VERTEX + UV + 1]])
        .toEqual([0, 0, 0.25, 0.25]);
    });

    it('mirrors within the source rect for a negative extent', () => {
      const one = packed(1);
      one[6] = -4;
      one[4] = 4;
      r.render([sprites(one)]);
      const v = imageQuadOf(quadUploads()[0], 0);
      expect([v[UV], v[2 * FLOATS_PER_VERTEX + UV]]).toEqual([0.25, 0]);
    });

    it('carries per-sprite opacity and multiplies it by group alpha', () => {
      r.render([{
        kind: 'group', alpha: 0.5, children: [sprites(packed(2, 0.5))],
      }] as unknown as DrawCommand[]);
      expect(imageQuadOf(quadUploads()[0], 0)[POST]).toBeCloseTo(0.25);
    });

    it('joins a run of image commands over the same bitmap', () => {
      r.render([img(0), sprites(packed(2)), img(60)]);
      expect(draws()).toEqual([24]);
    });

    it('takes its own texture slot, like any other image', () => {
      const other = bitmap();
      r.render([img(0), sprites(packed(2), { image: other }), img(60)]);
      expect(draws()).toEqual([24]);
      const v = quadUploads()[0];
      const slot = (vertex: number) => v[vertex * FLOATS_PER_VERTEX + SLOT] % BATCH_TEXTURE_SLOTS;
      // Both packed sprites carry the sheet's slot, and the quad after them
      // returns to the first bitmap's.
      expect([slot(0), slot(4), slot(8), slot(12)]).toEqual([1, 2, 2, 1]);
    });

    it('chunks past the per-flush cap and keeps drawing', () => {
      const cap = MAX_VERTICES_PER_BATCH / 4;
      r.render([sprites(packed(cap + 3))]);
      expect(draws()).toEqual([cap * 6, 18]);
    });

    it('ignores a trailing partial sprite and draws nothing for an empty run', () => {
      r.render([sprites(new Float32Array(SPRITE_STRIDE + 4))]);
      expect(draws()).toEqual([6]);
      recorder.reset();
      r.render([sprites(new Float32Array(0))]);
      expect(draws()).toEqual([]);
    });
  });

  it('chunks a run past the per-flush vertex cap', () => {
    const cap = MAX_VERTICES_PER_BATCH / 4;
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
    for (let i = 0; i <= SOLID_RING_SIZE; i++) {
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
