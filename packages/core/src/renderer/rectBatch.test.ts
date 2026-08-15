/**
 * Batching of consecutive solid-fill rects into one draw.
 *
 * Painter's order is the whole contract, so most of this file is about what
 * *breaks* a run rather than what merges into one. A missing flush does not
 * throw or drop pixels — it paints them in the wrong order, or under the wrong
 * group state, which only a test like these or a visual diff catches.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder, type GLCall } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { MAX_RECTS_PER_BATCH } from './rectBatch';

const ARRAY_BUFFER = 0x8892;
const STENCIL_TEST = 0x0B90;

describe('renderer — consecutive rect batching', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  const rect = (x: number, color = '#ff0000', extra: object = {}): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x, y: 0, width: 10, height: 10 },
    fill: { color },
    ...extra,
  } as DrawCommand);

  const gradientRect = (x: number): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x, y: 0, width: 10, height: 10 },
    fill: {
      fill: 'linear-gradient',
      from: { x: 0, y: 0 }, to: { x: 10, y: 10 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    },
  } as DrawCommand);

  /** Halves every channel and lifts red by a quarter. The bias is what these
   *  tests read: `u_colorMatrix` is uploaded from a scratch array the recorder
   *  captures by reference, so by assertion time it holds the last value sent. */
  const tinted = ((): number[] => {
    const cm = new Array(20).fill(0);
    cm[0] = 0.5; cm[6] = 0.5; cm[12] = 0.5; cm[18] = 1;
    cm[4] = 0.25;
    return cm;
  })();

  /** Index count of every drawElements, in issue order. */
  const draws = (): number[] =>
    recorder.calls.filter((c) => c.name === 'drawElements').map((c) => c.args[1] as number);

  /** The program bound at each drawElements, in issue order. */
  const drawPrograms = (): unknown[] => {
    const out: unknown[] = [];
    let bound: unknown = null;
    for (const c of recorder.calls) {
      if (c.name === 'useProgram') bound = c.args[0];
      if (c.name === 'drawElements') out.push(bound);
    }
    return out;
  };

  it('merges a run of solid rects into one draw', () => {
    r.render([rect(0), rect(20), rect(40)]);
    expect(draws()).toEqual([18]); // 3 rects × 6 indices
    expect(drawPrograms()).toEqual([r._pathFillVColor().handle]);
  });

  it('merges across the no-op wrapper groups the scene emits', () => {
    // `buildSceneTree` gives every node its own group with no transform,
    // alpha, colorMatrix or clip. Nothing about a draw can differ across one,
    // so the run has to survive it — this is the shape the app renders.
    r.render([0, 20, 40].map(
      (x) => ({ kind: 'group', children: [rect(x)] }) as unknown as DrawCommand,
    ));
    expect(draws()).toEqual([18]);
  });

  it('flushes a run under the state it was staged in, not the live one', () => {
    r.render([
      { kind: 'group', colorMatrix: tinted, children: [rect(0)] } as unknown as DrawCommand,
      rect(40),
    ]);
    // The group's run is still staged when the group pops. What breaks it is
    // the rect that follows, by which point the group's color matrix is off the
    // stack — the flush has to use it anyway or the rect draws untinted.
    const uBias = r._pathFillVColor().uniform('u_colorBias');
    const biasAtDraw: number[] = [];
    let pending = 0;
    for (const c of recorder.calls) {
      if (c.name === 'uniform4f' && c.args[0] === uBias) pending = c.args[1] as number;
      if (c.name === 'drawElements') biasAtDraw.push(pending);
    }
    expect(draws()).toEqual([6, 6]);
    expect(biasAtDraw).toEqual([0.25, 0]);
  });

  it('puts each rect at its own corners in one interleaved upload', () => {
    r.render([rect(0), rect(20)]);
    const upload = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER,
    )!;
    const verts = upload.args[2] as Float32Array;
    expect(upload.args[4]).toBe(48); // 2 rects × 4 verts × 6 floats
    // First rect's four corners, position pairs only.
    const positions = (rectIndex: number): number[] => {
      const out: number[] = [];
      for (let v = 0; v < 4; v++) {
        const at = rectIndex * 24 + v * 6;
        out.push(verts[at], verts[at + 1]);
      }
      return out;
    };
    expect(positions(0)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    expect(positions(1)).toEqual([20, 0, 30, 0, 30, 10, 20, 10]);
  });

  it('carries per-rect color on the vertices, leaving u_color white', () => {
    r.render([rect(0, '#ff0000'), rect(20, '#0000ff')]);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    expect(Array.from(verts.slice(2, 6))).toEqual([1, 0, 0, 1]);
    expect(Array.from(verts.slice(26, 30))).toEqual([0, 0, 1, 1]);
    // Anything but white here would tint the whole batch.
    const uColor = r._pathFillVColor().uniform('u_color');
    const sent = recorder.calls.filter((c) => c.name === 'uniform4f' && c.args[0] === uColor);
    expect(sent).toHaveLength(1);
    expect(sent[0].args.slice(1)).toEqual([1, 1, 1, 1]);
  });

  it('folds fill opacity into the vertex alpha', () => {
    r.render([{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { color: '#ff0000', opacity: 0.25 },
    } as DrawCommand]);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    expect(verts[5]).toBeCloseTo(0.25, 6);
  });

  it('flushes for a fill kind it cannot express, keeping painter\'s order', () => {
    r.render([rect(0), gradientRect(20), rect(40)]);
    const progs = drawPrograms();
    expect(progs).toHaveLength(3);
    expect(progs[0]).toBe(r._pathFillVColor().handle);
    expect(progs[1]).toBe(r._gradFill().handle);
    expect(progs[2]).toBe(r._pathFillVColor().handle);
    expect(draws()).toEqual([6, 6, 6]);
  });

  it('flushes the fill before the same command\'s stroke', () => {
    r.render([
      rect(0),
      rect(20, '#ff0000', { stroke: { width: 2, paint: { color: '#000' } } }),
      rect(40),
    ]);
    // The stroked rect's fill still merges with the run ahead of it (12), then
    // the run flushes so the stroke (48) lands on top of its own fill.
    expect(draws()).toEqual([12, 48, 6]);
  });

  it('flushes before text, so a rect behind a label stays behind it', () => {
    r.render([rect(0), { kind: 'text', x: 0, y: 0, runs: [], maxWidth: Infinity, align: 'left', style: {} } as unknown as DrawCommand, rect(20)]);
    expect(draws().filter((n) => n === 6)).toHaveLength(2);
  });

  it('merges across a group transform, placing corners itself', () => {
    const shifted = new Float32Array([1, 0, 0, 0, 1, 0, 30, 40, 1]);
    r.render([
      rect(0),
      { kind: 'group', transform: shifted, children: [rect(20)] } as unknown as DrawCommand,
      rect(40),
    ]);
    expect(draws()).toEqual([18]);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    // Middle rect: x 20 + tx 30, y 0 + ty 40.
    expect(Array.from(verts.slice(24, 26))).toEqual([50, 40]);
    // ...and its neighbours are untransformed in the same buffer.
    expect(Array.from(verts.slice(0, 2))).toEqual([0, 0]);
    expect(Array.from(verts.slice(48, 50))).toEqual([40, 0]);
  });

  it('rotates each corner rather than the batch', () => {
    // Quarter turn: (x, y) → (-y, x). A rect maps to a parallelogram, which the
    // two-triangle index pattern still covers.
    const quarterTurn = new Float32Array([0, 1, 0, -1, 0, 0, 0, 0, 1]);
    r.render([
      { kind: 'group', transform: quarterTurn, children: [rect(0)] } as unknown as DrawCommand,
    ]);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    const corners: number[] = [];
    for (let v = 0; v < 4; v++) corners.push(verts[v * 6], verts[v * 6 + 1]);
    expect(corners).toEqual([0, 0, 0, 10, -10, 10, -10, 0]);
  });

  it('merges across a group alpha, folding it into the vertex alpha', () => {
    r.render([
      rect(0),
      { kind: 'group', alpha: 0.5, children: [rect(20)] } as unknown as DrawCommand,
      rect(40),
    ]);
    expect(draws()).toEqual([18]);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    expect(verts[5]).toBe(1);
    expect(verts[29]).toBeCloseTo(0.5, 6);
    expect(verts[53]).toBe(1);
    // Folded means the uniform must not apply it a second time.
    const uAlpha = r._pathFillVColor().uniform('u_alpha');
    const sent = recorder.calls.filter((c) => c.name === 'uniform1f' && c.args[0] === uAlpha);
    expect(sent).toHaveLength(1);
    expect(sent[0].args[1]).toBe(1);
  });

  it('keeps alpha a uniform, and a barrier, under a color matrix', () => {
    // `a = clamp(CM * src + bias).a * u_alpha` — with a real matrix between
    // them, an alpha pre-multiplied onto the vertex is a different number.
    r.render([{
      kind: 'group',
      colorMatrix: tinted,
      children: [
        rect(0),
        { kind: 'group', alpha: 0.5, children: [rect(20)] } as unknown as DrawCommand,
      ],
    } as unknown as DrawCommand]);
    expect(draws()).toEqual([6, 6]);
    const uAlpha = r._pathFillVColor().uniform('u_alpha');
    const sent = recorder.calls
      .filter((c) => c.name === 'uniform1f' && c.args[0] === uAlpha)
      .map((c) => c.args[1]);
    expect(sent).toEqual([1, 0.5]);
  });

  it('does not merge across a group color matrix', () => {
    r.render([
      rect(0),
      { kind: 'group', colorMatrix: tinted, children: [rect(20)] } as unknown as DrawCommand,
      rect(40),
    ]);
    expect(draws()).toEqual([6, 6, 6]);
  });

  it('draws a clipped run under the clip, and the next run without it', () => {
    r.render([
      {
        kind: 'group',
        clip: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
        children: [rect(0), rect(20)],
      } as unknown as DrawCommand,
      rect(40),
    ]);
    // Clipped children merge with each other but not with what follows the pop.
    const batched = draws().filter((n) => n === 12);
    expect(batched).toHaveLength(1);
    // The batched draw must be issued while the clip stencil is live, or it
    // spills past the group's clip rect.
    const stencilStateAt = (i: number): boolean => {
      let on = false;
      for (let k = 0; k < i; k++) {
        const c: GLCall = recorder.calls[k];
        if (c.name === 'enable' && c.args[0] === STENCIL_TEST) on = true;
        if (c.name === 'disable' && c.args[0] === STENCIL_TEST) on = false;
      }
      return on;
    };
    const at = recorder.calls.findIndex((c) => c.name === 'drawElements' && c.args[1] === 12);
    expect(stencilStateAt(at)).toBe(true);
  });

  it('chunks a run longer than the per-flush cap', () => {
    const many = Array.from({ length: MAX_RECTS_PER_BATCH + 1 }, (_, i) => rect(i));
    r.render(many);
    expect(draws()).toEqual([MAX_RECTS_PER_BATCH * 6, 6]);
  });
});
