import { describe, it, expect, beforeEach } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';
import type { RectPath, PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

describe('WeaselRenderer.render — kind: path (nonzero solid)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('issues a drawElements call with the mesh index count', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { paint: { color: '#ff0000' } } }]);
    const draw = recorder.calls.find((c) => c.name === 'drawElements');
    expect(draw).toBeDefined();
    expect(draw!.args[1]).toBe(6);                                 // 2 triangles × 3
    expect(draw!.args[2]).toBe(recorder.gl.UNSIGNED_INT);
  });

  it('skips paths with no fill', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path }]);
    const draw = recorder.calls.find((c) => c.name === 'drawElements');
    expect(draw).toBeUndefined();
  });
});

describe('WeaselRenderer.render — kind: path (evenodd stencil two-pass)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('enables stencil and issues two drawElements for an evenodd path', () => {
    const path = stencilledEvenOdd({
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
    });
    r.render([{ kind: 'path', path, fill: { paint: { color: '#ff0000' } } }]);

    const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
    const enabledStencil = enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST);
    expect(enabledStencil).toBe(true);

    const drawCalls = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(drawCalls.length).toBe(2);
  });

  it('clears the parity bit after the cover pass', () => {
    const path = stencilledEvenOdd({
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
    });
    r.render([{ kind: 'path', path, fill: { paint: { color: '#ff0000' } } }]);
    const names = recorder.calls.map((c) => c.name);
    const cover = names.lastIndexOf('drawElements');
    const clear = names.lastIndexOf('clear');
    expect(clear).toBeGreaterThan(cover);
    expect(recorder.calls[clear].args).toEqual([recorder.gl.STENCIL_BUFFER_BIT]);
    expect(recorder.calls[clear - 1]).toMatchObject({ name: 'stencilMask', args: [0x01] });
  });
});

describe('WeaselRenderer.render — kind: path with stroke', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('draws stroke (drawElements) when stroke is set', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 2 } }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBeGreaterThan(0);
  });

  it('draws fill THEN stroke when both are set', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { paint: { color: '#f00' } }, stroke: { paint: { color: '#000' }, width: 2 } }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    // Both are solid geometry, so they share one draw — and inside it the fill
    // is staged first, which is what puts the stroke on top.
    expect(draws.length).toBe(1);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    expect(Array.from(verts.slice(2, 5))).toEqual([1, 0, 0]);   // fill red, first
    expect(Array.from(verts.slice(4 * FLOATS_PER_VERTEX + 2, 4 * FLOATS_PER_VERTEX + 5)))
      .toEqual([0, 0, 0]); // stroke black, after
  });

  it('skips when neither fill nor stroke is set', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(0);
  });

  // A stroke whose fields were seeded one at a time onto a node that had none
  // arrives with no `paint`. It paints nothing rather than throwing the frame
  // away — commands reach here from consumer painters and overlays too.
  it('skips a stroke that carries no paint, and still paints the fill', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, stroke: { width: 2 } }]);
    expect(recorder.calls.filter((c) => c.name === 'drawElements').length).toBe(0);

    recorder.reset();
    r.render([{ kind: 'path', path, fill: { paint: { color: '#f00' } }, stroke: { width: 2 } }]);
    expect(recorder.calls.filter((c) => c.name === 'drawElements').length).toBe(1);
  });

  it('uses stencil two-pass when stroking a PolygonPath that is not convex with align: inner', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, L, Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 50, 50, 0, 100]),
      fillRule: 'nonzero',
    };
    r.render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 10, align: 'inner' } }]);
    const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
    expect(enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST)).toBe(true);
    expect(recorder.calls.find((c) => c.name === 'stencilFunc')).toBeDefined();
    // Mask pass + paint pass = 2 drawElements minimum.
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT use stencil when stroking a PolygonPath with align: center', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
      fillRule: 'nonzero',
    };
    r.render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 10, align: 'center' } }]);
    const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
    const stencilEnabled = enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST);
    expect(stencilEnabled).toBe(false);
  });

  it('does NOT use stencil for RectPath (alignment baked into geometry)', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    r.render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 10, align: 'inner' } }]);
    const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
    const stencilEnabled = enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST);
    expect(stencilEnabled).toBe(false);
  });
});

describe('WeaselRenderer.render — stencil bit discipline', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('drawPathFillStencil only touches bit 0 — clip-level bits 1-7 survive', () => {
    const path = stencilledEvenOdd({
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
    });
    r.render([{ kind: 'path', path, fill: { paint: { color: '#ff0000' } } }]);

    // The function must only set stencilMask to 0x01 (bit 0) or 0xFF (the
    // frame-start full-restore from WeaselRenderer.render). Never a clip-bit mask.
    const stencilMaskCalls = recorder.calls.filter((c) => c.name === 'stencilMask');
    expect(stencilMaskCalls.length).toBeGreaterThan(0);
    for (const call of stencilMaskCalls) {
      expect([0x01, 0xFF]).toContain(call.args[0]);
    }

    const stencilFuncCalls = recorder.calls.filter((c) => c.name === 'stencilFunc');
    expect(stencilFuncCalls.length).toBeGreaterThan(0);
    for (const call of stencilFuncCalls) {
      // stencilFunc(func, ref, mask) — mask is args[2]
      expect(call.args[2]).toBe(0x01);
    }
  });

  it('drawPathStrokeStenciled only touches bit 0 — clip-level bits 1-7 survive', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, L, Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 50, 50, 0, 100]),
      fillRule: 'nonzero',
    };
    r.render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 10, align: 'inner' } }]);

    // The function must only set stencilMask to 0x01 (bit 0) or 0xFF (frame-start restore).
    const stencilMaskCalls = recorder.calls.filter((c) => c.name === 'stencilMask');
    expect(stencilMaskCalls.length).toBeGreaterThan(0);
    for (const call of stencilMaskCalls) {
      expect([0x01, 0xFF]).toContain(call.args[0]);
    }

    const stencilFuncCalls = recorder.calls.filter((c) => c.name === 'stencilFunc');
    expect(stencilFuncCalls.length).toBeGreaterThan(0);
    for (const call of stencilFuncCalls) {
      expect(call.args[2]).toBe(0x01);
    }
  });
});
