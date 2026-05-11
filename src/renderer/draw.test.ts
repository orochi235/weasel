import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { mat3 } from './math/mat3';
import type { DrawCommand } from './DrawCommand';
import { pushClip, popClip, drawGroup, dispatch, type DrawContext } from './draw';

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
    imageFill: r._imageFill(),
    gradFill: r._gradFill(),
    meshCache: r._meshCache(),
    textureCache: r._textureCache(),
    imageCache: r._imageCache(),
    gradRampCache: r._gradRampCache(),
    programRegistry: new Map(),
    quadVbo: null,
    quadIbo: null,
    rectVao: null,
    rectVbo: null,
    state: r._groupState(),
    widthCss: r._widthCss(),
    heightCss: r._heightCss(),
    clipDepth: 0,
  };
  return { ctx, calls: recorder.calls, gl: recorder.gl };
}

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

  it('walks nested groups recursively', () => {
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

import type { RectPath } from '@orochi235/weasel';

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

import type { PolygonPath } from '@orochi235/weasel';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@orochi235/weasel';

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
    expect(draws.length).toBe(2);
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

    const stencilMaskCalls = recorder.calls.filter((c) => c.name === 'stencilMask');
    expect(stencilMaskCalls.length).toBeGreaterThan(0);
    for (const call of stencilMaskCalls) {
      expect(call.args[0]).toBe(0x01);
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

    const stencilMaskCalls = recorder.calls.filter((c) => c.name === 'stencilMask');
    expect(stencilMaskCalls.length).toBeGreaterThan(0);
    for (const call of stencilMaskCalls) {
      expect(call.args[0]).toBe(0x01);
    }

    const stencilFuncCalls = recorder.calls.filter((c) => c.name === 'stencilFunc');
    expect(stencilFuncCalls.length).toBeGreaterThan(0);
    for (const call of stencilFuncCalls) {
      expect(call.args[2]).toBe(0x01);
    }
  });
});

import { registerFont, _resetFontRegistryForTests } from 'features/text/atlas/registerFont';
import { FIXTURE_FONT } from 'features/text/atlas/FontAtlas';
import { vi } from 'vitest';

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
    await registerFont('inter', '/fonts/inter.json', '/fonts/inter.png');

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
        { kind: 'text', x: 0, y: 0, text: 'A', style: { fontFamily: 'inter', fontSize: 32, fill: { color: '#fff' } } },
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
      kind: 'text', x: 0, y: 0, text: 'A',
      style: { fontFamily: 'inter', fontSize: 32, fill: { color: '#fff' } },
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
