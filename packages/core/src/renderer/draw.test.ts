import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { mat3 } from './math/mat3';
import type { DrawCommand } from './DrawCommand';
import { pushClip, popClip, drawGroup, dispatch, tryStageSolid, type DrawContext } from './draw';

/**
 * Build a DrawContext backed by a GL recorder. Mirrors what WeaselRenderer.render
 * assembles internally, using the _*() accessors exposed for testing.
 */
function createRecorderCtx(): { ctx: DrawContext; calls: ReturnType<typeof makeGLRecorder>['calls']; gl: ReturnType<typeof makeGLRecorder>['gl'] } {
  const recorder = makeGLRecorder();
  const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  recorder.reset();
  const ctx: DrawContext = {
    gl: recorder.gl,
    pathFill: r._pathFill(),
    pathFillVColor: r._pathFillVColor(),
    textSdf: r._textSdf(),
    textSdfR8: r._textSdfR8(),
    imageFill: r._imageFill(),
    gradFill: r._gradFill(),
    patternFill: r._patternFill(),
    meshCache: r._meshCache(),
    textureCache: r._textureCache(),
    imageCache: r._imageCache(),
    gradRampCache: r._gradRampCache(),
    programRegistry: new Map(),
    quadVbo: null,
    quadIbo: null,
    solidBatch: r._solidBatch(),
    state: r._groupState(),
    widthCss: r._widthCss(),
    heightCss: r._heightCss(),
    clipDepth: 0,
  };
  return { ctx, calls: recorder.calls, gl: recorder.gl };
}

/**
 * A vertex-data upload, whichever call carried it. The text ring writes into a
 * slot whose buffer it already owns, so its geometry arrives by
 * `bufferSubData`; every other draw path still mints a buffer and uses
 * `bufferData`.
 */
const isVertexUpload = (c: { name: string; args: readonly unknown[] }): boolean =>
  (c.name === 'bufferData' && c.args[1] instanceof Float32Array)
  || (c.name === 'bufferSubData' && c.args[2] instanceof Float32Array);

/** The floats an upload carried. */
const uploadFloats = (c: { name: string; args: readonly unknown[] }): Float32Array =>
  (c.name === 'bufferData' ? c.args[1] : c.args[2]) as Float32Array;

describe('WeaselRenderer.render — kind: group', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('clears the framebuffer at the start of render', () => {
    r.render([]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('clear');
  });

  it('walks an empty group without throwing', () => {
    const cmd: DrawCommand = { kind: 'group', children: [] };
    expect(() => r.render([cmd])).not.toThrow();
  });

  it('walks nested draw-groups recursively', () => {
    const cmd: DrawCommand = {
      kind: 'group',
      transform: mat3.translate(mat3.identity(), 10, 0),
      children: [
        {
          kind: 'group',
          transform: mat3.translate(mat3.identity(), 0, 20),
          children: [],
        },
      ],
    };
    expect(() => r.render([cmd])).not.toThrow();
  });
});

import type { RectPath } from '@weasel-js/core';

describe('WeaselRenderer.render — kind: path (nonzero solid)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('binds the path-fill program before drawing a path', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('useProgram');
  });

  it('issues a drawElements call with the mesh index count', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
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

import type { PolygonPath } from '@weasel-js/core';
import { PATH_M as M, PATH_L as L, PATH_Z as Z, PATH_C as C } from '@weasel-js/core';

describe('WeaselRenderer.render — kind: path (evenodd stencil two-pass)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('enables stencil and issues two drawElements for an evenodd path', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);

    const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
    const enabledStencil = enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST);
    expect(enabledStencil).toBe(true);

    const drawCalls = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(drawCalls.length).toBe(2);
  });

  it('clears stencil before the mask pass', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const clearCalls = recorder.calls.filter((c) => c.name === 'clear');
    expect(clearCalls.length).toBeGreaterThanOrEqual(1);
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
    r.render([{ kind: 'path', path, fill: { color: '#f00' }, stroke: { paint: { color: '#000' }, width: 2 } }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    // Both are solid geometry, so they share one draw — and inside it the fill
    // is staged first, which is what puts the stroke on top.
    expect(draws.length).toBe(1);
    const verts = recorder.calls.find(
      (c) => c.name === 'bufferSubData' && c.args[0] === recorder.gl.ARRAY_BUFFER,
    )!.args[2] as Float32Array;
    expect(Array.from(verts.slice(2, 5))).toEqual([1, 0, 0]);   // fill red, first
    expect(Array.from(verts.slice(26, 29))).toEqual([0, 0, 0]); // stroke black, after
  });

  it('skips when neither fill nor stroke is set', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(0);
  });

  it('uses stencil two-pass when stroking a PolygonPath with align: inner', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
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
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);

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
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
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

import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { vi } from 'vitest';
import { resolveTextStyle } from '@weasel-js/core';
import { layoutRuns } from '@weasel-js/text';
import { verticalAlignOffset } from '@weasel-js/text';
import type { ResolvedRun } from '@weasel-js/text';

describe('WeaselRenderer.render — color matrix on text + image', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(async () => {
    _resetFontRegistryForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');

    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  // 4×5 row-major color matrix that drops red. Identity except m[0]=0.
  const NO_RED: number[] = [
    0, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ];

  it('uploads u_colorMatrix and u_colorBias during a text draw inside a group with colorMatrix', () => {
    const cmd: DrawCommand = {
      kind: 'group',
      colorMatrix: NO_RED,
      children: [
        { kind: 'text', x: 0, y: 0, runs: [{ text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal', fill: { fill: 'solid', color: '#fff' }, letterSpacing: 0, underline: false, strikethrough: false }], align: 'left', style: { fontFamily: 'inter', fontSize: 32 } },
      ],
    };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const biasCalls = recorder.calls.filter((c) => c.name === 'uniform4f');
    expect(matrixCalls.length).toBeGreaterThan(0);
    // The matrix payload is a Float32Array of length 16.
    const someIsColorMatrix = matrixCalls.some((c) => {
      const arr = c.args[2];
      return arr instanceof Float32Array && arr.length === 16 && arr[0] === 0 && arr[5] === 1;
    });
    expect(someIsColorMatrix).toBe(true);
    expect(biasCalls.length).toBeGreaterThan(0);
  });

  it('uploads u_colorMatrix and u_colorBias during an image draw inside a group with colorMatrix', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = {
      kind: 'group',
      colorMatrix: NO_RED,
      children: [
        { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 },
      ],
    };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const someIsColorMatrix = matrixCalls.some((c) => {
      const arr = c.args[2];
      return arr instanceof Float32Array && arr.length === 16 && arr[0] === 0 && arr[5] === 1;
    });
    expect(someIsColorMatrix).toBe(true);
  });

  it('uploads identity u_colorMatrix on text draws with no enclosing group transform', () => {
    const cmd: DrawCommand = {
      kind: 'text', x: 0, y: 0,
      runs: [{ text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal', fill: { fill: 'solid', color: '#fff' }, letterSpacing: 0, underline: false, strikethrough: false }],
      align: 'left',
      style: { fontFamily: 'inter', fontSize: 32 },
    };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const identityUploaded = matrixCalls.some((c) => {
      const arr = c.args[2];
      if (!(arr instanceof Float32Array) || arr.length !== 16) return false;
      // Column-major identity: diagonal ones.
      return arr[0] === 1 && arr[5] === 1 && arr[10] === 1 && arr[15] === 1;
    });
    expect(identityUploaded).toBe(true);
  });

  it('uploads identity u_colorMatrix on image draws with no enclosing group transform', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 };
    r.render([cmd]);
    const matrixCalls = recorder.calls.filter((c) => c.name === 'uniformMatrix4fv');
    const identityUploaded = matrixCalls.some((c) => {
      const arr = c.args[2];
      if (!(arr instanceof Float32Array) || arr.length !== 16) return false;
      return arr[0] === 1 && arr[5] === 1 && arr[10] === 1 && arr[15] === 1;
    });
    expect(identityUploaded).toBe(true);
  });

  it('sets NEAREST mag filter for sampling:"nearest" image draws', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = {
      kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64, sampling: 'nearest',
    };
    r.render([cmd]);
    const magCalls = recorder.calls.filter(
      (c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER,
    );
    expect(magCalls.at(-1)?.args[2]).toBe(recorder.gl.NEAREST);
  });

  it('restores LINEAR for an unsampled draw following a nearest one', () => {
    // The first render warms GLImageCache, whose upload() emits its own
    // MAG_FILTER call. Resetting after it leaves only the per-draw calls, so
    // this fails if drawImage stops setting the filter — which the naive
    // version of this test could not detect.
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    r.render([{ kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64 }]);
    recorder.reset();

    r.render([
      { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64, sampling: 'nearest' },
      { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64 },
    ]);
    const magFilters = recorder.calls
      .filter((c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER)
      .map((c) => c.args[2]);
    expect(magFilters).toEqual([recorder.gl.NEAREST, recorder.gl.LINEAR]);
  });

  // The quad geometry is a persistent ring rather than a per-draw VAO and two
  // buffers, which cost 5.4 us a draw. See tests/perf/image-quad.spec.ts.
  it('mints no GL objects for an image draw once the quad ring exists', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const img = { kind: 'image' as const, image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 };
    r.render([img]);
    recorder.reset();

    r.render([img, img, img]);
    const named = (name: string) => recorder.calls.filter((c) => c.name === name);
    expect(named('createVertexArray')).toHaveLength(0);
    expect(named('createBuffer')).toHaveLength(0);
    expect(named('deleteVertexArray')).toHaveLength(0);
    expect(named('deleteBuffer')).toHaveLength(0);
  });

  it('draws neighbouring images from different ring slots', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const img = { kind: 'image' as const, image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 };
    r.render([img]);
    recorder.reset();

    r.render([img, img]);
    const bound = recorder.calls
      .filter((c) => c.name === 'bindVertexArray' && c.args[0] !== null)
      .map((c) => c.args[0]);
    expect(bound).toHaveLength(2);
    // Same slot twice in a row is the stall this ring exists to avoid.
    expect(bound[0]).not.toBe(bound[1]);
  });

  it('frees the quad ring on dispose', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    r.render([{ kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 }]);
    recorder.reset();

    r.dispose();
    const deletedVaos = recorder.calls.filter((c) => c.name === 'deleteVertexArray');
    expect(deletedVaos.length).toBeGreaterThan(1);
  });
});

describe('pushClip / popClip', () => {
  it('pushClip(level=1): sets bit 1 wherever the clip path covers, no ancestor test needed', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    pushClip(ctx, path, /* newDepth */ 1);
    // stencilMask should be 0x02 (bit 1) for the write
    expect(calls.find((c) => c.name === 'stencilMask' && c.args[0] === 0x02)).toBeDefined();
    // stencilFunc EQUAL ref=0x02 mask=0x00 (no ancestors at depth 1)
    const sf = calls.find((c) => c.name === 'stencilFunc');
    expect(sf!.args).toEqual([gl.EQUAL, 0x02, 0x00]);
    // stencilOp KEEP KEEP REPLACE
    const so = calls.find((c) => c.name === 'stencilOp');
    expect(so!.args).toEqual([gl.KEEP, gl.KEEP, gl.REPLACE]);
    // colorMask false then true (stencil-only pass)
    const cmCalls = calls.filter((c) => c.name === 'colorMask');
    expect(cmCalls[0].args).toEqual([false, false, false, false]);
    expect(cmCalls[cmCalls.length - 1].args).toEqual([true, true, true, true]);
  });

  it('pushClip(level=3): only writes bit 3 where bits 1+2 are already set', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    pushClip(ctx, path, /* newDepth */ 3);
    const sf = calls.find((c) => c.name === 'stencilFunc');
    // ref includes bits 1, 2, 3 (=0x0E); mask is ancestors only (bits 1+2 = 0x06)
    expect(sf!.args).toEqual([gl.EQUAL, 0x0E, 0x06]);
    // stencilMask for the new bit (filter out the 0x01 narrowing from
    // surrounding code if present)
    const clipSm = calls.find((c) => c.name === 'stencilMask' && c.args[0] !== 0x01);
    expect(clipSm!.args).toEqual([0x08]);  // bit 3
  });

  it('popClip(oldDepth=2): clears bit 3 along the path, preserves ancestor bits', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    popClip(ctx, path, /* oldDepth */ 2);
    // ref = ancestorMask(2) | (1 << 3) = 0x06 | 0x08 = 0x0E
    const sf = calls.find((c) => c.name === 'stencilFunc');
    expect(sf!.args).toEqual([gl.EQUAL, 0x0E, 0x0E]);
    // stencilMask = bit 3 only (filter out 0x01 narrowing if any)
    const clipSm = calls.find((c) => c.name === 'stencilMask' && c.args[0] !== 0x01);
    expect(clipSm!.args).toEqual([0x08]);
    // stencilOp ZERO for the write
    const so = calls.find((c) => c.name === 'stencilOp');
    expect(so!.args).toEqual([gl.KEEP, gl.KEEP, gl.ZERO]);
  });

  /**
   * Rasterizing into the stencil is what creates the obligation, so the flush
   * belongs to these two rather than to whoever calls them. `flushSolids`
   * touches no stencil state beyond enable/disable, so the first
   * stencilMask/Func/Op call is the clip op's own.
   */
  describe('drain the staged run first', () => {
    const stagedRect: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 },
      fill: { color: '#ff0000' },
    } as DrawCommand;
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };

    const drainedBeforeStencil = (calls: ReturnType<typeof createRecorderCtx>['calls']): void => {
      const flushIdx = calls.findIndex((c) => c.name === 'drawElements');
      const stencilIdx = calls.findIndex(
        (c) => c.name === 'stencilMask' || c.name === 'stencilFunc' || c.name === 'stencilOp',
      );
      expect(flushIdx).toBeGreaterThanOrEqual(0);
      expect(stencilIdx).toBeGreaterThan(flushIdx);
    };

    it('pushClip', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, stagedRect);
      pushClip(ctx, path, /* newDepth */ 1);
      drainedBeforeStencil(calls);
    });

    it('popClip', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, stagedRect);
      popClip(ctx, path, /* oldDepth */ 0);
      drainedBeforeStencil(calls);
    });
  });
});

import type { Mesh } from './cache/mesh';

/**
 * The chokepoint that makes a forgotten flush unexpressible: an emitter only
 * gets to draw for itself when this said `false`, and `false` is only returned
 * after the staged run has been drawn.
 */
describe('tryStageSolid', () => {
  const stagedRect: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { color: '#ff0000' },
  } as DrawCommand;

  const triangle = (vertexCount = 3, extra: Partial<Mesh> = {}): Mesh => ({
    vertices: new Float32Array(vertexCount * 2),
    indices: new Uint32Array([0, 1, 2]),
    ...extra,
  });

  /** A run is staged and undrawn; anything the recorder draws came from a flush. */
  function withStagedRun(): { ctx: DrawContext; drawCount: () => number } {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, stagedRect);
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(0);
    return { ctx, drawCount: () => calls.filter((c) => c.name === 'drawElements').length };
  }

  it('stages a batchable mesh, leaving the run undrawn', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageSolid(ctx, triangle(), { color: '#0000ff' })).toBe(true);
    expect(drawCount()).toBe(0);
  });

  it('flushes before answering false for a paint a run cannot carry', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageSolid(ctx, triangle(), undefined)).toBe(false);
    expect(drawCount()).toBe(1);
  });

  it('flushes before answering false for a mesh past the vertex cap', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageSolid(ctx, triangle(1024), { color: '#0000ff' })).toBe(false);
    expect(drawCount()).toBe(1);
  });

  it('flushes before answering false for a mesh needing its own stencil pass', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageSolid(ctx, triangle(3, { requiresStencil: true }), { color: '#0000ff' })).toBe(false);
    expect(drawCount()).toBe(1);
  });
});

import type { GroupDrawCommand } from './DrawCommand';

describe('drawGroup clip integration', () => {
  it('drawGroup with cmd.clip pushes clip and children draw under the test', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 },
      children: [{
        kind: 'path' as const,
        path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 },
        fill: { color: '#fff' },
      }],
    };
    drawGroup(ctx, cmd);
    // Find: stencilMask(0x02) before child draw, stencilFunc(EQUAL, 0x02, 0x02)
    // during child, popClip-style stencilOp ZERO after children.
    const idxPushMask = calls.findIndex(
      (c) => c.name === 'stencilMask' && c.args[0] === 0x02
    );
    const idxChildTest = calls.findIndex(
      (c, i) => i > idxPushMask
        && c.name === 'stencilFunc'
        && c.args[1] === 0x02
        && c.args[2] === 0x02
    );
    const idxPop = calls.findIndex(
      (c, i) => i > idxChildTest
        && c.name === 'stencilOp'
        && c.args[2] === gl.ZERO
    );
    expect(idxPushMask).toBeGreaterThanOrEqual(0);
    expect(idxChildTest).toBeGreaterThan(idxPushMask);
    expect(idxPop).toBeGreaterThan(idxChildTest);
  });

  it('drawGroup with cmd.clip stencils an image child (EQUAL against clip bit)', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 },
      children: [{ kind: 'image' as const, image: fakeBitmap, x: 0, y: 0, w: 16, h: 16 }],
    };
    drawGroup(ctx, cmd);

    // The image draw's applyClipTest at clipDepth=1: EQUAL against ancestor
    // mask 0x02 (bit 1), KEEP on all ops. Find that stencilFunc, then confirm
    // STENCIL_TEST is enabled at that point and a drawElements follows it
    // before the popClip clear pass (stencilOp ..., ZERO).
    const clipTestIdx = calls.findIndex(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL && c.args[1] === 0x02 && c.args[2] === 0x02,
    );
    expect(clipTestIdx).toBeGreaterThanOrEqual(0);
    let enabled = false;
    for (let i = clipTestIdx; i >= 0; i--) {
      if (calls[i].name === 'disable' && calls[i].args[0] === gl.STENCIL_TEST) break;
      if (calls[i].name === 'enable' && calls[i].args[0] === gl.STENCIL_TEST) { enabled = true; break; }
    }
    expect(enabled).toBe(true);
    const popClipIdx = calls.findIndex(
      (c) => c.name === 'stencilOp' && c.args[2] === gl.ZERO,
    );
    const drawAfterClipTest = calls.findIndex(
      (c, i) => i > clipTestIdx && c.name === 'drawElements',
    );
    expect(drawAfterClipTest).toBeGreaterThan(clipTestIdx);
    expect(popClipIdx).toBeGreaterThan(drawAfterClipTest);
  });

  it('drawGroup without cmd.clip does not touch clip-level stencil bits', () => {
    const { ctx, calls } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      children: [{
        kind: 'path' as const,
        path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 },
        fill: { color: '#fff' },
      }],
    };
    drawGroup(ctx, cmd);
    // No stencilMask writes to bits 1-7.
    const clipBitWrites = calls.filter(
      (c) => c.name === 'stencilMask'
        && c.args[0] !== 0x01
        && c.args[0] !== 0xff
        && c.args[0] !== 0
    );
    expect(clipBitWrites).toEqual([]);
  });

  it('drawGroup throws at depth 8', () => {
    // Build a chain of 8 nested clip groups.
    let cmd: GroupDrawCommand = {
      kind: 'group',
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
        fill: { color: '#fff' },
      }],
    };
    for (let i = 0; i < 8; i++) {
      cmd = {
        kind: 'group',
        clip: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
        children: [cmd],
      };
    }
    const { ctx } = createRecorderCtx();
    expect(() => drawGroup(ctx, cmd)).toThrow(/clip nesting depth exceeded \(max 7\)/);
  });
});

// Helper: a minimal polygon path for evenodd fill.
const POLYGON_EVENODD: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
  fillRule: 'evenodd',
};

// Helper: a polygon path for stroke-stencil (inner/outer) — needs visible area.
const POLYGON_NONZERO: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
  fillRule: 'nonzero',
};

describe('stencil-shaded passes honor ancestor clip', () => {
  it('drawPathFillStencil shaded pass uses EQUAL clipMask|0x01 when clipDepth=2', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 2;
    // ancestorMask(2) = 0x06, so shaded ref = 0x07, mask = 0x07
    dispatch(ctx, { kind: 'path', path: POLYGON_EVENODD, fill: { color: '#f00' } });

    // The shaded pass stencilFunc is the last EQUAL call (write pass uses ALWAYS).
    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x07, 0x07]);
  });

  it('drawPathFillStencil shaded pass collapses to EQUAL 0x01 0x01 when clipDepth=0', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 0;
    dispatch(ctx, { kind: 'path', path: POLYGON_EVENODD, fill: { color: '#f00' } });

    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x01, 0x01]);
  });

  it('drawPathStrokeStenciled inner shaded pass uses EQUAL clipMask|0x01 when clipDepth=1', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 1;
    // ancestorMask(1) = 0x02, inner ref = 0x03, mask = 0x03
    dispatch(ctx, {
      kind: 'path',
      path: POLYGON_NONZERO,
      stroke: { paint: { color: '#000' }, width: 10, align: 'inner' },
    });

    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x03, 0x03]);
  });

  it('drawPathStrokeStenciled outer shaded pass: ref=clipMask, mask=clipMask|0x01 when clipDepth=1', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    ctx.clipDepth = 1;
    // ancestorMask(1) = 0x02, outer ref = 0x02 (bit 0 NOT set), mask = 0x03
    dispatch(ctx, {
      kind: 'path',
      path: POLYGON_NONZERO,
      stroke: { paint: { color: '#000' }, width: 10, align: 'outer' },
    });

    const equalCalls = calls.filter(
      (c) => c.name === 'stencilFunc' && c.args[0] === gl.EQUAL
    );
    expect(equalCalls.length).toBeGreaterThan(0);
    const shadedSF = equalCalls[equalCalls.length - 1];
    expect(shadedSF.args).toEqual([gl.EQUAL, 0x02, 0x03]);
  });
});

// ─── C1/I4 ────────────────────────────────────────────────────────────────────

describe('C1/I4: popClip enables STENCIL_TEST after evenodd child disables it', () => {
  it('popClip enables STENCIL_TEST even after a child disabled it', () => {
    const { ctx, calls, gl } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 },
      children: [{
        kind: 'path' as const,
        // evenodd polygon child — drawPathFillStencil ends with disable(STENCIL_TEST)
        path: POLYGON_EVENODD,
        fill: { color: '#f00' },
      }],
    };
    drawGroup(ctx, cmd);

    // Find the popClip's stencilOp(KEEP, KEEP, ZERO) — the clear pass.
    // findLastIndex is ES2023+; use a manual reverse scan for TS compat.
    let popClipIdx = -1;
    for (let i = calls.length - 1; i >= 0; i--) {
      if (calls[i].name === 'stencilOp' && calls[i].args[2] === gl.ZERO) {
        popClipIdx = i;
        break;
      }
    }
    expect(popClipIdx).toBeGreaterThanOrEqual(0);

    // Walk backwards from the pop; confirm enable(STENCIL_TEST) appears before
    // any disable(STENCIL_TEST) in that backward scan.
    let foundEnable = false;
    for (let i = popClipIdx; i >= 0; i--) {
      if (calls[i].name === 'disable' && calls[i].args[0] === gl.STENCIL_TEST) break;
      if (calls[i].name === 'enable' && calls[i].args[0] === gl.STENCIL_TEST) {
        foundEnable = true;
        break;
      }
    }
    expect(foundEnable).toBe(true);
  });

  it('pushClip and popClip restore stencilMask(0xFF) on exit', () => {
    const { ctx, calls } = createRecorderCtx();
    const cmd: GroupDrawCommand = {
      kind: 'group',
      clip: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 },
      children: [],
    };
    drawGroup(ctx, cmd);

    // After the full group (push + pop), the last stencilMask call should be 0xFF.
    const stencilMaskCalls = calls.filter((c) => c.name === 'stencilMask');
    expect(stencilMaskCalls.length).toBeGreaterThan(0);
    const last = stencilMaskCalls[stencilMaskCalls.length - 1];
    expect(last.args[0]).toBe(0xFF);
  });
});

// ─── C2 ───────────────────────────────────────────────────────────────────────

describe('C2: frame-start stencilMask(0xFF) before clear', () => {
  it('render() sets stencilMask(0xFF) before clear(STENCIL_BUFFER_BIT)', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
    r.render([]);
    const calls = recorder.calls;
    const clearIdx = calls.findIndex(
      (c) => c.name === 'clear' && (c.args[0] as number) & recorder.gl.STENCIL_BUFFER_BIT,
    );
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    // stencilMask(0xFF) must appear before the clear.
    const maskBeforeClear = calls
      .slice(0, clearIdx)
      .some((c) => c.name === 'stencilMask' && c.args[0] === 0xFF);
    expect(maskBeforeClear).toBe(true);
  });
});

describe('drawText synthetic-bold', () => {
  beforeEach(() => {
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
  });

  it('sets u_synthBold to ~0.08 when a group has synthetic.bold=true', async () => {
    _resetFontRegistryForTests();
    // Register only the regular weight; request bold via a run → synthetic.bold=true
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 700,
        fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
        letterSpacing: 0,
        underline: false, strikethrough: false,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    // Find u_synthBold uniform sets via uniform1f calls. The exact location
    // (which arg index is the value) is calls.find by uniform location: the
    // recorder tracks uniform1f as `{ name: 'uniform1f', args: [loc, value] }`.
    const synthBoldVals = calls
      .filter((c) => c.name === 'uniform1f')
      .map((c) => c.args[1] as number);
    expect(synthBoldVals.some((v) => Math.abs(v - 0.08) < 1e-6)).toBe(true);
  });

  it('sets u_synthBold to 0 for an exact-match variant', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 700,
        fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
        letterSpacing: 0,
        underline: false, strikethrough: false,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const synthBoldVals = calls
      .filter((c) => c.name === 'uniform1f')
      .map((c) => c.args[1] as number);
    expect(synthBoldVals.some((v) => Math.abs(v - 0.08) < 1e-6)).toBe(false);
  });
});

// Curved polygon (bezier segments) so the solid-rect fast path can't
// intercept — needed to prove getMesh vs. fresh tessellate() is actually
// exercised by flattenTolerance.
const POLYGON_CURVED: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, C, C, Z]),
  coords: new Float32Array([
    0, 0,
    40, -40, 80, -40, 100, 0,
    80, 100, 20, 100, 0, 0,
  ]),
  fillRule: 'nonzero',
};

describe('flattenTolerance option', () => {
  /** A gradient takes its own draw, so the mesh reaches GL as a buffer rather
   *  than as staged vertices — which is where the pool choice is observable. */
  const GRADIENT = {
    fill: 'linear-gradient' as const,
    from: { x: 0, y: 0 }, to: { x: 100, y: 100 },
    stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
  };

  const stagedVertexFloats = (rec: ReturnType<typeof makeGLRecorder>): number =>
    rec.calls.find((c) => c.name === 'bufferSubData' && c.args[0] === rec.gl.ARRAY_BUFFER)!
      .args[4] as number;

  it('tessellates fresh when flattenTolerance is set', () => {
    const render = (flattenTolerance?: number): ReturnType<typeof makeGLRecorder> => {
      const rec = makeGLRecorder();
      const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1, flattenTolerance });
      r.render([{ kind: 'path', path: POLYGON_CURVED, fill: { fill: 'solid', color: '#000' } }]);
      return rec;
    };
    // A finer tolerance means more segments, so the staged run is longer. The
    // persistent cache's key excludes tolerance, so serving from it would give
    // both renders the same count.
    expect(stagedVertexFloats(render(0.01)))
      .toBeGreaterThan(stagedVertexFloats(render()));
  });

  it('routes a mesh that takes its own draw through the transient pool', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1, flattenTolerance: 0.01 });
    r.render([{ kind: 'path', path: POLYGON_CURVED, fill: GRADIENT }]);
    // Transient meshes are freed at end of render(): deleteVertexArray proves
    // the fill did NOT come from the persistent cache.
    expect(rec.calls.map((c) => c.name)).toContain('deleteVertexArray');
  });

  it('default path (no option) keeps the persistent cache route', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    r.render([{ kind: 'path', path: POLYGON_CURVED, fill: GRADIENT }]);
    expect(rec.calls.map((c) => c.name)).not.toContain('deleteVertexArray');
  });
});

describe('drawText synthetic-italic', () => {
  beforeEach(() => {
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
  });

  it('sets u_synthItalic to ~0.2094 when a group has synthetic.italic=true', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'italic', fill: { fill: 'solid', color: '#000' },
        letterSpacing: 0,
        underline: false, strikethrough: false,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const uniform1fVals = calls
      .filter((c) => c.name === 'uniform1f')
      .map((c) => c.args[1] as number);
    expect(uniform1fVals.some((v) => Math.abs(v - 0.2094) < 1e-3)).toBe(true);
  });

  it('sets u_synthItalic to 0 for an exact-match italic variant', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'italic', fill: { fill: 'solid', color: '#000' },
        letterSpacing: 0,
        underline: false, strikethrough: false,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const uniform1fVals = calls
      .filter((c) => c.name === 'uniform1f')
      .map((c) => c.args[1] as number);
    expect(uniform1fVals.some((v) => Math.abs(v - 0.2094) < 1e-3)).toBe(false);
  });
});

describe('drawText verticalAlign', () => {
  beforeEach(() => {
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
  });

  // First vertex of the first quad in the first (and only, for this fixture
  // font/text) vertex upload of the text VBO: stride is [x, y, u, v,
  // baselineY], so index 1 is y0.
  function firstQuadY0(calls: ReturnType<typeof makeGLRecorder>['calls']): number {
    const upload = calls.find(
      isVertexUpload,
    );
    if (!upload) throw new Error('no text vertex upload recorded');
    return uploadFloats(upload)[1];
  }

  it('shifts emitted quad y-coordinates by verticalAlignOffset(verticalAlign, height, textHeight)', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');

    const runs: ResolvedRun[] = [{
      text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
      fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
      letterSpacing: 0,
      underline: false, strikethrough: false,
    }];
    const style = {};

    const { ctx: ctxTop, calls: callsTop } = createRecorderCtx();
    dispatch(ctxTop, { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style });
    const y0Top = firstQuadY0(callsTop);

    const boxHeight = 100;
    const { ctx: ctxCentered, calls: callsCentered } = createRecorderCtx();
    dispatch(ctxCentered, {
      kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style,
      height: boxHeight, verticalAlign: 'center',
    });
    const y0Centered = firstQuadY0(callsCentered);

    const resolved = resolveTextStyle(style);
    const laid = layoutRuns(runs, { maxWidth: Infinity, lineHeight: resolved.lineHeight, align: 'left' });
    const expectedDy = verticalAlignOffset('center', boxHeight, laid.bounds.height);

    expect(expectedDy).not.toBe(0);
    expect(y0Centered - y0Top).toBeCloseTo(expectedDy, 5);
  });

  it('leaves quads untouched (dy=0) when verticalAlign/height are omitted', async () => {
    _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');

    const runs: ResolvedRun[] = [{
      text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
      fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
      letterSpacing: 0,
      underline: false, strikethrough: false,
    }];

    const { ctx: ctxA, calls: callsA } = createRecorderCtx();
    dispatch(ctxA, { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style: {} });

    const { ctx: ctxB, calls: callsB } = createRecorderCtx();
    dispatch(ctxB, { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style: {}, verticalAlign: 'top' });

    expect(firstQuadY0(callsB)).toBe(firstQuadY0(callsA));
  });
});

import { registerCanvasFont } from '@weasel-js/font';
import { _resetDynamicFontsForTests, __setGlyphRasterizerForTests } from '@weasel-js/font/test-seams';

describe('drawText — canvas-dynamic routing', () => {
  beforeEach(() => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
    registerCanvasFont('Dyn');
  });

  it('binds the R8 program and dynamic page texture for a canvas group', () => {
    const { ctx, calls } = createRecorderCtx();
    const cmd: DrawCommand = {
      kind: 'text',
      x: 10, y: 10,
      runs: [{
        text: 'A', fontFamily: 'Dyn', fontWeight: 400, fontStyle: 'normal',
        fontSize: 24, fill: { fill: 'solid', color: '#000' },
      }],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand;
    dispatch(ctx, cmd);
    const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
    expect(used).toContain(ctx.textSdfR8.handle);
    expect(used).not.toContain(ctx.textSdf.handle);
    // Full page upload happened (texImage2D — the recorder can't see the R8 format args).
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });
});

import {
  setFontFallbackPolicy, setDefaultFontFamily, getFontFallbackPolicy,
} from '@weasel-js/font';

/**
 * The 'substitute' fallback policy is only real if the substitute atlas
 * actually reaches the GPU. A correct `ResolveResult.substituted` proves
 * nothing here — these assert uploads and draw calls.
 */
describe('drawText — substituted family reaches the GPU', () => {
  let priorPolicy: ReturnType<typeof getFontFallbackPolicy>;

  beforeEach(async () => {
    priorPolicy = getFontFallbackPolicy();
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    setFontFallbackPolicy('substitute');
    setDefaultFontFamily('inter');
  });

  afterEach(() => {
    setFontFallbackPolicy(priorPolicy);
  });

  const ghostText = (): DrawCommand => ({
    kind: 'text', x: 0, y: 0,
    runs: [{
      text: 'A', fontFamily: 'ghost', fontSize: 16, fontWeight: 400,
      fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
      letterSpacing: 0,
      underline: false, strikethrough: false,
    }],
    maxWidth: Infinity, align: 'left', style: {},
  });

  it('uploads an atlas texture for text in an unregistered family', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, ghostText());
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('draws quads for text in an unregistered family', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, ghostText());
    const draws = calls.filter((c) => c.name === 'drawElements');
    expect(draws).toHaveLength(1);
    // 1 glyph → 2 triangles → 6 indices.
    expect(draws[0].args[1]).toBe(6);
    const vbo = calls.find(isVertexUpload);
    expect(vbo).toBeDefined();
  });

  it('renders nothing for an unregistered family under the "none" policy', () => {
    setFontFallbackPolicy('none');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, ghostText());
    expect(calls.some((c) => c.name === 'drawElements')).toBe(false);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(false);
  });

  it('still draws a registered family through the exact-match path', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
        letterSpacing: 0,
        underline: false, strikethrough: false,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
  });
});

/**
 * Tracking is only real if it reaches the vertex buffer. Layout returning
 * wider bounds proves nothing here — this asserts the uploaded quad x's.
 */
describe('drawText — letterSpacing reaches the GPU', () => {
  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  });

  // x of each quad's first vertex in the text VBO (stride 5 floats, 4 verts/quad).
  function quadX0s(calls: ReturnType<typeof makeGLRecorder>['calls']): number[] {
    const upload = calls.find(isVertexUpload);
    if (!upload) throw new Error('no text vertex upload recorded');
    const data = uploadFloats(upload);
    const out: number[] = [];
    for (let i = 0; i < data.length; i += 20) out.push(data[i]);
    return out;
  }

  function drawTracked(letterSpacing: number): number[] {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'AB', fontFamily: 'inter', fontSize: 32, fontWeight: 400,
        fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
        letterSpacing,
        underline: false, strikethrough: false,
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    return quadX0s(calls);
  }

  it('shifts uploaded glyph x-coordinates by N * letterSpacing', () => {
    const plain = drawTracked(0);
    const tracked = drawTracked(6);
    expect(plain).toHaveLength(2);
    expect(tracked).toHaveLength(2);
    expect(tracked[0]).toBeCloseTo(plain[0]);        // first glyph unmoved
    expect(tracked[1] - plain[1]).toBeCloseTo(6);    // second glyph tracked once
  });
});

import { resetBakeBudget } from '@weasel-js/font';

/**
 * Decoration is a producer/consumer feature with exactly the shape that hides
 * bugs: layout can compute a perfect rule and the renderer can silently drop
 * it, leaving text that measures right and paints no line. So these assert on
 * the draw calls and the uploaded vertex data, never on `LaidOutRuns`.
 */
describe('drawText — decoration reaches the GPU', () => {
  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  });

  const ARRAY_BUFFER = 0x8892;

  /**
   * Every drawElements issued while `prog` was the bound program, paired with
   * the ARRAY_BUFFER upload and `u_color` that fed it. The recorder is a flat
   * call log, so attribution means replaying the state it records.
   */
  function drawsWithProgram(
    calls: ReturnType<typeof makeGLRecorder>['calls'],
    prog: { handle: unknown },
  ): Array<{ vertices: Float32Array; indexCount: number; color: number[] }> {
    const out: Array<{ vertices: Float32Array; indexCount: number; color: number[] }> = [];
    let bound: unknown = null;
    let vertices: Float32Array | null = null;
    let color: number[] = [];
    for (const c of calls) {
      if (c.name === 'useProgram') bound = c.args[0];
      if (isVertexUpload(c) && c.args[0] === ARRAY_BUFFER) {
        vertices = uploadFloats(c);
      }
      if (c.name === 'uniform4f') color = c.args.slice(1) as number[];
      if (c.name === 'drawElements' && bound === prog.handle) {
        out.push({ vertices: vertices!, indexCount: c.args[1] as number, color });
      }
    }
    return out;
  }

  /** Float32Array truncation means an exact `toEqual` on decimals fails. */
  function expectVertices(actual: Float32Array, expected: number[]): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) expect(actual[i]).toBeCloseTo(expected[i], 4);
  }

  const decoratedRun = (extra: Record<string, unknown>) => ({
    text: 'A', fontFamily: 'inter', fontSize: 32, fontWeight: 400,
    fontStyle: 'normal' as const, fill: { fill: 'solid' as const, color: '#000' },
    letterSpacing: 0, underline: false, strikethrough: false, ...extra,
  });

  // FIXTURE_FONT at fontSize 32 → scale 1: 'A' advances 23, baseline is at
  // common.base = 29. Underline top = 29 + 0.10*32 = 32.2, 0.05*32 = 1.6 thick.
  it('emits the underline rect through the path-fill program', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ underline: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);

    const draws = drawsWithProgram(calls, ctx.pathFill);
    expect(draws).toHaveLength(1);
    expect(draws[0].indexCount).toBe(6);
    // 4 vertices, 2 floats each (pathFill takes a_position only — no UVs).
    expectVertices(draws[0].vertices, [0, 32.2, 23, 32.2, 0, 33.8, 23, 33.8]);
  });

  it('emits nothing through the path-fill program when decoration is off', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({})],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    expect(drawsWithProgram(calls, ctx.pathFill)).toHaveLength(0);
    // ...but the glyph itself still drew.
    expect(drawsWithProgram(calls, ctx.textSdf)).toHaveLength(1);
  });

  it('emits the strikethrough rect above the baseline', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ strikethrough: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    const draws = drawsWithProgram(calls, ctx.pathFill);
    expect(draws).toHaveLength(1);
    // Top = 29 - 0.30*32 = 19.4, bottom = 21.
    expectVertices(draws[0].vertices, [0, 19.4, 23, 19.4, 0, 21, 23, 21]);
  });

  it('batches both rules of a doubly-decorated run into one draw', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [decoratedRun({ underline: true, strikethrough: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    const draws = drawsWithProgram(calls, ctx.pathFill);
    expect(draws).toHaveLength(1);
    expect(draws[0].indexCount).toBe(12);
    expect(draws[0].vertices).toHaveLength(16);
  });

  it('paints the rule in the run fill, and splits the draw when fills differ', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [
        decoratedRun({ underline: true }),
        decoratedRun({ text: 'B', underline: true, fill: { fill: 'solid', color: '#ff0000' } }),
      ],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);
    const draws = drawsWithProgram(calls, ctx.pathFill);
    expect(draws).toHaveLength(2);
    expect(draws.map((d) => d.color)).toEqual([[0, 0, 0, 1], [1, 0, 0, 1]]);
  });

  it('shifts the rule by the verticalAlign offset, with the glyphs', () => {
    const runs = [decoratedRun({ underline: true })];
    const cmd = { kind: 'text', x: 0, y: 0, runs, maxWidth: Infinity, align: 'left', style: {} };

    const { ctx: ctxA, calls: callsA } = createRecorderCtx();
    dispatch(ctxA, cmd as DrawCommand);
    const { ctx: ctxB, calls: callsB } = createRecorderCtx();
    dispatch(ctxB, { ...cmd, height: 100, verticalAlign: 'center' } as DrawCommand);

    const yA = drawsWithProgram(callsA, ctxA.pathFill)[0].vertices[1];
    const yB = drawsWithProgram(callsB, ctxB.pathFill)[0].vertices[1];
    const glyphYA = drawsWithProgram(callsA, ctxA.textSdf)[0].vertices[1];
    const glyphYB = drawsWithProgram(callsB, ctxB.textSdf)[0].vertices[1];
    expect(yB - yA).not.toBe(0);
    // The rule must move by exactly what the glyphs moved by, or it detaches.
    expect(yB - yA).toBeCloseTo(glyphYB - glyphYA, 6);
  });

  it('draws the rule when nothing has baked yet, so there are no groups at all', () => {
    // A canvas-dynamic glyph past the bake budget lays out with a real advance
    // but `page: -1`, which emits no quad. Layout therefore returns zero
    // groups while still carrying the rule; a `groups.length === 0` bail-out
    // in drawText would swallow it.
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
    registerCanvasFont('Dyn');
    resetBakeBudget(0);
    try {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, {
        kind: 'text', x: 0, y: 0,
        runs: [decoratedRun({ fontFamily: 'Dyn', underline: true })],
        maxWidth: Infinity, align: 'left', style: {},
      } as DrawCommand);
      expect(drawsWithProgram(calls, ctx.textSdfR8)).toHaveLength(0);
      expect(drawsWithProgram(calls, ctx.textSdf)).toHaveLength(0);
      expect(drawsWithProgram(calls, ctx.pathFill)).toHaveLength(1);
    } finally {
      resetBakeBudget();
      _resetDynamicFontsForTests();
    }
  });

  it('draws the rule under the enclosing clip, as the glyphs are', () => {
    const { ctx, calls } = createRecorderCtx();
    drawGroup(ctx, {
      kind: 'group',
      clip: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      children: [{
        kind: 'text', x: 0, y: 0,
        runs: [decoratedRun({ underline: true })],
        maxWidth: Infinity, align: 'left', style: {},
      }],
    } as never);
    // The rule's draw must be issued with the clip stencil live, or it spills
    // past the group's clip rect. Anchor on the decoration VBO upload — the
    // clip's own rasterization also binds pathFill, so the program alone
    // can't identify our draw.
    // (The clip rect's own mesh is also 8 floats, so match on the rule's y.)
    const at = calls.findIndex(
      (c) => isVertexUpload(c)
        && uploadFloats(c).length === 8
        && Math.abs(uploadFloats(c)[1] - 32.2) < 1e-3,
    );
    expect(at).toBeGreaterThanOrEqual(0);
    let enabled = false;
    let func: unknown[] | null = null;
    for (const c of calls.slice(0, at)) {
      if (c.name === 'enable' && c.args[0] === 0x0B90) enabled = true;
      if (c.name === 'disable' && c.args[0] === 0x0B90) enabled = false;
      if (c.name === 'stencilFunc') func = c.args as unknown[];
    }
    expect(enabled).toBe(true);
    // EQUAL against the depth-1 ancestor mask (bit 1 → 0x02).
    expect(func).toEqual([0x0202, 0x02, 0x02]);
  });

  it('uploads the group color matrix and alpha for the rule, as the glyph path does', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'group',
      alpha: 0.5,
      // Row-major 4×5 that swaps the red and green channels.
      colorMatrix: [
        0, 1, 0, 0, 0,
        1, 0, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0,
      ],
      children: [{
        kind: 'text', x: 0, y: 0,
        runs: [decoratedRun({ underline: true })],
        maxWidth: Infinity, align: 'left', style: {},
      }],
    } as DrawCommand);
    // Look only at what was uploaded after pathFill was bound for the rule.
    const from = calls.findIndex((c) => c.name === 'useProgram' && c.args[0] === ctx.pathFill.handle);
    expect(from).toBeGreaterThanOrEqual(0);
    const after = calls.slice(from);
    // Group alpha reaches u_alpha, and the group color matrix reaches
    // u_colorMatrix — the rule must be tinted and faded like the glyphs.
    expect(after.some((c) => c.name === 'uniform1f' && c.args[1] === 0.5)).toBe(true);
    // u_proj / u_model, without which the rect lands in raw clip space.
    expect(after.filter((c) => c.name === 'uniformMatrix3fv')).toHaveLength(2);
    const cm = after.find((c) => c.name === 'uniformMatrix4fv');
    expect(cm).toBeDefined();
    // The same matrix, transposed to column-major as setColorMatrixUniforms does.
    expect(Array.from(cm!.args[2] as Float32Array)).toEqual([
      0, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });
});

import { registerFontOutlines, glyphOutline } from '@weasel-js/font';
import { _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetOutlineMeshCacheForTests } from './cache/outlineMeshCache';

/**
 * The outline tier's renderer half. Layout decides *which* glyphs escalate
 * (see `layoutRuns.test.ts`); these assert what the renderer then does with
 * them — which program it binds, that a group is still one draw call, and
 * that em-space geometry lands where the glyph was laid out.
 */
describe('drawText — outline tier', () => {
  // A unit triangle: apex one em above the baseline, base on it.
  const GLYPH_D = 'M0 0L1 0L0.5 -1Z';
  const SIZE = 100; // comfortably past the 48-screen-px threshold at scale 1

  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    _resetFontOutlinesForTests();
    _resetOutlineMeshCacheForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) =>
      url.endsWith('.json')
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
        : Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
          })) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue(
      { width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
    await registerFont('inter', { weight: 400, style: 'normal' }, '/f.json', '/f.png');

    registerFontOutlines('inter', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({ unitsPerEm: 1000, glyphD: (cp: number) => (cp === 32 ? null : GLYPH_D) }),
    });
    // Drive the (async) face load to ready, the way a second frame would.
    glyphOutline('inter', 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));
  });

  const textCmd = (text: string, extra: Partial<Record<string, unknown>> = {}): DrawCommand => ({
    kind: 'text',
    x: 0, y: 0,
    runs: [{
      text, fontFamily: 'inter', fontWeight: 400, fontStyle: 'normal',
      fontSize: SIZE, fill: { fill: 'solid', color: '#000' }, ...extra,
    }],
    maxWidth: Infinity, align: 'left', style: {},
  } as DrawCommand);

  /** Vertex buffers uploaded this frame, in upload order. */
  const uploads = (calls: readonly { name: string; args: readonly unknown[] }[]): Float32Array[] =>
    calls.filter(isVertexUpload)
      .map(uploadFloats);

  it('draws outline glyphs through pathFill, not the SDF programs', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A'));
    const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
    expect(used).toContain(ctx.pathFill.handle);
    expect(used).not.toContain(ctx.textSdf.handle);
    expect(used).not.toContain(ctx.textSdfR8.handle);
  });

  it('batches a whole group into one draw call', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('AAAA'));
    // Four glyphs, one buffer, one draw — the batching the atlas tier gets
    // from packing glyphs into a texture. A model matrix per glyph would have
    // traded that away.
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
    const verts = uploads(calls);
    expect(verts).toHaveLength(1);
    expect(verts[0].length).toBe(4 * 3 * 2); // 4 glyphs × 3 vertices × (x, y)
  });

  it('places em-space geometry at the pen and baseline, scaled by fontSize', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A'));
    const v = uploads(calls)[0];

    const ys = [v[1], v[3], v[5]];
    const xs = [v[0], v[2], v[4]];
    // The triangle's base sits on the baseline and its apex one em above.
    const baselineY = Math.max(...ys);
    expect(Math.min(...ys)).toBeCloseTo(baselineY - SIZE, 4);
    // One em wide, starting at the pen (x = 0 for the first glyph of a
    // left-aligned line at origin 0).
    expect(Math.min(...xs)).toBeCloseTo(0, 4);
    expect(Math.max(...xs)).toBeCloseTo(SIZE, 4);
  });

  it('shears synthetic obliques the same way the SDF vertex shader does', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A', { fontStyle: 'italic' }));
    const v = uploads(calls)[0];

    const ys = [v[1], v[3], v[5]];
    const xs = [v[0], v[2], v[4]];
    const apex = ys.indexOf(Math.min(...ys));
    // `x += (baselineY - y) * tan(12°)`: a vertex one em above the baseline
    // leans right by tan(12°) em. Below-baseline vertices lean the other way,
    // which is what keeps the glyph attached to its own baseline.
    expect(xs[apex] - 0.5 * SIZE).toBeCloseTo(Math.tan(0.2094) * SIZE, 3);
  });

  it('leaves small text on the atlas tier', () => {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, textCmd('A', { fontSize: 12 }));
    const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
    expect(used).toContain(ctx.textSdf.handle);
  });

  it('pulls small text across the threshold once the view is zoomed in', () => {
    const { ctx, calls } = createRecorderCtx();
    // 12 world px at 8× is 96 on screen — the rule is what the eye sees, not
    // what the document says.
    ctx.state.push({ transform: new Float32Array([8, 0, 0, 0, 8, 0, 0, 0, 1]) });
    dispatch(ctx, textCmd('A', { fontSize: 12 }));
    ctx.state.pop();
    const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
    expect(used).toContain(ctx.pathFill.handle);
    expect(used).not.toContain(ctx.textSdf.handle);
  });

  it('honours a renderer that turns the tier off', () => {
    const { ctx, calls } = createRecorderCtx();
    ctx.textOutlineMinScreenSize = Infinity;
    dispatch(ctx, textCmd('A'));
    const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
    expect(used).toContain(ctx.textSdf.handle);
    expect(used).not.toContain(ctx.pathFill.handle);
  });

  it('moves outline glyphs with verticalAlign, like the quads', () => {
    const top = createRecorderCtx();
    dispatch(top.ctx, { ...textCmd('A'), height: 400, verticalAlign: 'top' } as DrawCommand);
    const bottom = createRecorderCtx();
    dispatch(bottom.ctx, { ...textCmd('A'), height: 400, verticalAlign: 'bottom' } as DrawCommand);

    const yOf = (calls: readonly { name: string; args: readonly unknown[] }[]) => uploads(calls)[0][1];
    expect(yOf(bottom.calls)).toBeGreaterThan(yOf(top.calls));
  });

  /**
   * Stroked text. A glyph on this tier is an ordinary `PolygonPath`, so the
   * stroke is the same tessellated ribbon any path gets — real joins, caps
   * and miters, at any width, in any paint.
   */
  describe('stroke', () => {
    const STROKE = { paint: { fill: 'solid' as const, color: '#f00' }, width: 4 };

    it('adds a second draw call for the stroke, batched like the fill', () => {
      const plain = createRecorderCtx();
      dispatch(plain.ctx, textCmd('AAAA'));
      expect(plain.calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);

      const stroked = createRecorderCtx();
      dispatch(stroked.ctx, textCmd('AAAA', { stroke: STROKE }));
      // One for the four glyphs' fill, one for the four glyphs' stroke — the
      // stroke batches over the group exactly as the fill does.
      expect(stroked.calls.filter((c) => c.name === 'drawElements')).toHaveLength(2);
      expect(uploads(stroked.calls)).toHaveLength(2);
    });

    it('paints the stroke over the fill', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('A', { stroke: STROKE }));
      const order = calls.filter(isVertexUpload);
      const [fillVerts, strokeVerts] = order.map(uploadFloats);
      // The fill is the glyph's 3 vertices; the stroke ribbon is larger. That
      // asymmetry is what identifies which upload is which, and the order is
      // the assertion: fill first, stroke on top, as Canvas2D and SVG's
      // default paint-order both do it.
      expect(fillVerts.length).toBe(3 * 2);
      expect(strokeVerts.length).toBeGreaterThan(fillVerts.length);
    });

    it('straddles the glyph edge by half the stroke width', () => {
      const { ctx, calls } = createRecorderCtx();
      // Round joins on purpose: their outer boundary is an arc of half the
      // width about each corner, so the ribbon is bounded by exactly half a
      // width everywhere. A miter at this glyph's sharp corners overshoots
      // that legitimately, which would make the assertion about the join
      // rather than about the width.
      dispatch(ctx, textCmd('A', { stroke: { ...STROKE, join: 'round', cap: 'round' } }));
      const strokeVerts = uploads(calls)[1];
      const xs: number[] = [];
      for (let i = 0; i < strokeVerts.length; i += 2) xs.push(strokeVerts[i]);
      // The glyph spans x ∈ [0, SIZE]. A centred 4-unit stroke reaches half a
      // width outside it on each side, in world units — the stroke width is
      // not scaled by the font size. Precision 1 because the join arcs are
      // flattened at OUTLINE_FLATTEN_TOLERANCE em, which is ~0.02 world units
      // at this size.
      expect(Math.min(...xs)).toBeCloseTo(-STROKE.width / 2, 1);
      expect(Math.max(...xs)).toBeCloseTo(SIZE + STROKE.width / 2, 1);
    });

    it('draws nothing extra for a zero-width stroke', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('A', { stroke: { ...STROKE, width: 0 } }));
      expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(1);
    });

    it('escalates small text to outlines rather than dropping its stroke', () => {
      const { ctx, calls } = createRecorderCtx();
      dispatch(ctx, textCmd('A', { fontSize: 12, stroke: STROKE }));
      const used = calls.filter((c) => c.name === 'useProgram').map((c) => c.args[0]);
      // The size threshold picks between two correct renderings of unstroked
      // text. For a stroked run it would pick between a stroke and none, so
      // the run escalates at any size and the SDF tier never sees it.
      expect(used).toContain(ctx.pathFill.handle);
      expect(used).not.toContain(ctx.textSdf.handle);
    });
  });
});

describe('gradient units — which space u_worldInv maps fragments into', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  const STOPS = [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }];
  const PATH: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };

  /** Uniform locations are resolved at link time, inside the constructor —
   *  captured before `reset()` clears the log the assertions read. */
  let worldInvLocs: unknown[];

  /** The matrix uploaded to `u_worldInv` on the last gradient draw. */
  function worldInv(): number[] {
    const upload = recorder.calls
      .filter((c) => c.name === 'uniformMatrix3fv' && worldInvLocs.includes(c.args[0]))
      .pop();
    expect(upload, 'expected a u_worldInv upload').toBeDefined();
    return Array.from(upload!.args[2] as Float32Array);
  }

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    worldInvLocs = recorder.calls
      .filter((c) => c.name === 'getUniformLocation' && c.args[1] === 'u_worldInv')
      .map((c) => c.result);
    expect(worldInvLocs.length, 'gradient program should expose u_worldInv').toBeGreaterThan(0);
    recorder.reset();
  });

  it('defaults to screen space, leaving the mapping identity', () => {
    r.render([{ kind: 'path', path: PATH, fill: { fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, stops: STOPS } }]);
    expect(worldInv()).toEqual(Array.from(mat3.identity()));
  });

  it("units: 'local' inverts the enclosing transform, so the paint rides the geometry", () => {
    const transform = mat3.translate(mat3.identity(), 100, 40);
    r.render([{
      kind: 'group',
      transform,
      children: [{ kind: 'path', path: PATH, fill: { fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, stops: STOPS, units: 'local' } }],
    }]);
    // A fragment at screen (100, 40) is the group's local origin.
    expect(mat3.apply(new Float32Array(worldInv()), 100, 40)).toEqual([0, 0]);
  });

  it("units: 'world' inverts the frame's view matrix, pinning the paint to the scene", () => {
    const view = mat3.translate(mat3.identity(), 25, 75);
    r.render([{
      kind: 'group',
      transform: mat3.translate(mat3.identity(), 100, 40),
      children: [{ kind: 'path', path: PATH, fill: { fill: 'radial-gradient', center: { x: 0, y: 0 }, radius: 5, stops: STOPS, units: 'world' } }],
    }], view);
    // Screen (25, 75) is world origin — independent of the group transform.
    expect(mat3.apply(new Float32Array(worldInv()), 25, 75)).toEqual([0, 0]);
  });

  it("units: 'world' degrades to screen space when the caller passed no view", () => {
    r.render([{ kind: 'path', path: PATH, fill: { fill: 'conic-gradient', center: { x: 0, y: 0 }, angle: 0, stops: STOPS, units: 'world' } }]);
    expect(worldInv()).toEqual(Array.from(mat3.identity()));
  });
});

/**
 * `u_proj`, `u_model`, `u_colorMatrix` and `u_colorBias` are re-sent for every
 * draw command unless something remembers what the program already holds. GL
 * keeps uniform state per program object, so those repeats are pure cost — and
 * they were the majority of a frame at a few thousand commands.
 *
 * The cache lives on the per-frame `DrawContext`, so it cannot outlive a frame.
 * These tests pin both halves: repeats are dropped, and a value that genuinely
 * changes mid-frame is still uploaded. The second half is the one that matters
 * — a skipped upload there paints with the previous group's color matrix.
 */
describe('WeaselRenderer.render — redundant uniform uploads', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  const rect = (x: number): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x, y: 0, width: 10, height: 10 } as RectPath,
    fill: { color: '#ff0000' },
  });

  const countOf = (name: string): number =>
    recorder.calls.filter((c) => c.name === name).length;

  it('uploads the color matrix once for a frame of many identical-state draws', () => {
    r.render([rect(0), rect(20), rect(40), rect(60), rect(80)]);
    // The five rects merge into one batched draw.
    expect(countOf('drawElements')).toBe(1);
    expect(countOf('uniformMatrix4fv')).toBe(1);
  });

  it('uploads the projection once no matter how many commands', () => {
    r.render([rect(0), rect(20), rect(40), rect(60), rect(80)]);
    // u_proj + u_model, once each — not once per command.
    expect(countOf('uniformMatrix3fv')).toBeLessThanOrEqual(2);
  });

  it('re-uploads when a group changes the color matrix mid-frame', () => {
    // Identity for the first rect, a real matrix for the second.
    const tinted = new Array(20).fill(0);
    tinted[0] = 0.5; tinted[6] = 0.5; tinted[12] = 0.5; tinted[18] = 1;
    r.render([
      rect(0),
      { kind: 'group', colorMatrix: tinted, children: [rect(20)] } as unknown as DrawCommand,
      rect(40),
    ]);
    // Identity, then the tint, then back to identity on the way out.
    expect(countOf('uniformMatrix4fv')).toBeGreaterThanOrEqual(3);
  });

  it('re-uploads the model matrix when a group transform changes mid-frame', () => {
    // A mesh past the batch's vertex cap, so it takes its own draw: staged
    // geometry is transformed CPU-side and would never re-upload a model.
    const ring = (x: number): DrawCommand => {
      const n = 400;
      const commands = new Uint8Array(n + 1);
      const coords = new Float32Array(n * 2);
      commands[0] = M;
      for (let k = 1; k < n; k++) commands[k] = L;
      commands[n] = Z;
      for (let k = 0; k < n; k++) {
        coords[k * 2] = x + 10 * Math.cos((k * 2 * Math.PI) / n);
        coords[k * 2 + 1] = 10 * Math.sin((k * 2 * Math.PI) / n);
      }
      return {
        kind: 'path',
        path: { kind: 'polygon', commands, coords } as PolygonPath,
        fill: { color: '#ff0000' },
      };
    };
    const shifted = new Float32Array([1, 0, 0, 0, 1, 0, 30, 40, 1]);
    r.render([
      ring(0),
      { kind: 'group', transform: shifted, children: [ring(20)] } as unknown as DrawCommand,
      ring(40),
    ]);
    // proj once, then model for identity → shifted → identity.
    expect(countOf('uniformMatrix3fv')).toBeGreaterThanOrEqual(4);
  });

  it('starts each frame with a cold cache', () => {
    r.render([rect(0), rect(20)]);
    const first = countOf('uniformMatrix4fv');
    recorder.reset();
    r.render([rect(0), rect(20)]);
    expect(countOf('uniformMatrix4fv')).toBe(first);
  });
});

describe('vertex-colored stroke under a clip', () => {
  /** A stroke command whose per-anchor colors force the vertex-color program
   *  (and so the branch that draws the ribbon with its own color buffer). */
  function vColorStroke(): DrawCommand {
    return {
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1]),
        coords: new Float32Array([0, 0, 50, 0, 100, 0]),
        fillRule: 'nonzero',
      },
      stroke: {
        width: 4,
        paint: { color: '#ffffff' },
        vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
      },
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

describe('WeaselRenderer.render — kind: image, source rect and flip', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  const bitmap = (width: number, height: number) =>
    ({ width, height, close: () => {} }) as unknown as ImageBitmap;

  /** The image quad's 16 interleaved floats, copied out of the recorder.
   *  `IMAGE_QUAD_VERTICES` is one reused array, so the recorded reference
   *  reads as the *last* image draw — copy per call, one draw per render. */
  function imageQuad(): Float32Array {
    const call = recorder.calls.find(
      (c) => c.name === 'bufferSubData'
        && c.args[2] instanceof Float32Array
        && (c.args[2] as Float32Array).length === 16,
    );
    if (!call) throw new Error('no image quad upload recorded');
    return Float32Array.from(call.args[2] as Float32Array);
  }

  /** [u0, v0, u1, v1] — the UVs of the top-left and bottom-right corners. */
  function uvs(): [number, number, number, number] {
    const v = imageQuad();
    return [v[2], v[3], v[14], v[15]];
  }

  it('samples the whole bitmap when no source rect is given', () => {
    r.render([{ kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32 }]);
    expect(uvs()).toEqual([0, 0, 1, 1]);
  });

  it('normalizes a source rect by the bitmap dimensions', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 16, h: 16,
      source: { x: 16, y: 8, w: 16, h: 16 },
    }]);
    expect(uvs()).toEqual([16 / 64, 8 / 32, 32 / 64, 24 / 32]);
  });

  it('swaps the horizontal UVs for flipX', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32, flipX: true,
    }]);
    expect(uvs()).toEqual([1, 0, 0, 1]);
  });

  it('swaps the vertical UVs for flipY', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32, flipY: true,
    }]);
    expect(uvs()).toEqual([0, 1, 1, 0]);
  });

  it('swaps both axes for flipX + flipY', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32,
      flipX: true, flipY: true,
    }]);
    expect(uvs()).toEqual([1, 1, 0, 0]);
  });

  it('mirrors within the source rect, not the whole bitmap', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 16, h: 16,
      source: { x: 16, y: 8, w: 16, h: 16 }, flipX: true,
    }]);
    expect(uvs()).toEqual([32 / 64, 8 / 32, 16 / 64, 24 / 32]);
  });

  it('leaves the destination quad alone when flipping', () => {
    r.render([{ kind: 'image', image: bitmap(64, 32), x: 10, y: 20, w: 64, h: 32 }]);
    const plain = imageQuad();
    recorder.reset();
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 10, y: 20, w: 64, h: 32,
      flipX: true, flipY: true,
    }]);
    const flipped = imageQuad();
    // Positions are interleaved at 0,1 / 4,5 / 8,9 / 12,13.
    for (const i of [0, 1, 4, 5, 8, 9, 12, 13]) {
      expect(flipped[i]).toBe(plain[i]);
    }
  });

  it('passes a source rect past the bitmap edge through unclamped', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 16, h: 16,
      source: { x: 56, y: 24, w: 16, h: 16 },
    }]);
    expect(uvs()).toEqual([56 / 64, 24 / 32, 72 / 64, 40 / 32]);
  });
});
