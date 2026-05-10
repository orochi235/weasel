import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { mat3 } from './math/mat3';
import type { DrawCommand } from './DrawCommand';

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
