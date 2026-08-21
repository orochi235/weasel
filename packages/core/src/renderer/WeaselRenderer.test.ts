import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { registerProgram, _resetProgramRegistryForTests } from './shaders/registerProgram';

const MINIMAL_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0, 0.5, 1.0, 1.0); }
`;

describe('WeaselRenderer (constructor)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => {
    recorder = makeGLRecorder();
  });

  it('configures alpha blending', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('enable');
    expect(names).toContain('blendFunc');
    const blendFuncCall = recorder.calls.find((c) => c.name === 'blendFunc')!;
    // Premultiplied alpha blend — matches shader output of (rgb * a, a).
    expect(blendFuncCall.args).toEqual([recorder.gl.ONE, recorder.gl.ONE_MINUS_SRC_ALPHA]);
  });

  it('sets initial viewport to width × dpr by height × dpr', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 2 });
    const viewportCall = recorder.calls.find((c) => c.name === 'viewport')!;
    expect(viewportCall.args).toEqual([0, 0, 1600, 1200]);
  });

  it('compiles the path-fill shader during construction', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('compileShader');
    expect(names).toContain('linkProgram');
  });
});

describe('WeaselRenderer.resize', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => {
    recorder = makeGLRecorder();
  });

  it('updates viewport on resize', () => {
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
    r.resize({ width: 1024, height: 768, dpr: 2 });
    const viewportCall = recorder.calls.find((c) => c.name === 'viewport');
    expect(viewportCall).toBeDefined();
    expect(viewportCall!.args).toEqual([0, 0, 2048, 1536]);
  });

  it('updates the canvas drawingBuffer width/height', () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => recorder.gl,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as HTMLCanvasElement;
    const r = new WeaselRenderer({ canvas, width: 100, height: 100, dpr: 1 });
    r.resize({ width: 200, height: 150, dpr: 2 });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });
});

describe('WeaselRenderer context loss', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => {
    recorder = makeGLRecorder();
  });

  function makeFakeCanvas() {
    const listeners = new Map<string, EventListener>();
    return {
      width: 0,
      height: 0,
      getContext: () => recorder.gl,
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      removeEventListener: () => {},
      dispatchEvent: (type: string) => {
        listeners.get(type)?.(new Event(type) as unknown as Event);
        return true;
      },
    } as unknown as HTMLCanvasElement & { dispatchEvent: (t: string) => boolean };
  }

  it('frees GLMeshCache transient resources at the end of render()', () => {
    const r = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 100, dpr: 1 });
    const cache = r._meshCache();
    // Simulate a stroke draw allocating a transient ribbon mesh.
    cache.uploadTransient({
      vertices: new Float32Array([0, 0, 1, 0, 1, 1]),
      indices: new Uint32Array([0, 1, 2]),
    });
    expect(cache._transientCount()).toBe(1);
    recorder.reset();
    r.render([]);
    // Render freed the transient list; freeTransient runs after gl.clear so
    // no draw could observe deleted state.
    expect(cache._transientCount()).toBe(0);
    const names = recorder.calls.map((c) => c.name);
    const idxClear = names.indexOf('clear');
    const idxFirstDelete = names.findIndex(
      (n) => n === 'deleteVertexArray' || n === 'deleteBuffer',
    );
    expect(idxFirstDelete).toBeGreaterThan(idxClear);
  });

  it('drains GLMeshCache pending deletes at the start of render()', () => {
    const r = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 100, dpr: 1 });
    const cache = r._meshCache();
    cache._enqueueDeleteForTest({
      vao: { __id: 'vao_z' } as unknown as WebGLVertexArrayObject,
      vbo: { __id: 'vbo_z' } as unknown as WebGLBuffer,
      ibo: { __id: 'ibo_z' } as unknown as WebGLBuffer,
    });
    expect(cache._pendingDeleteCount()).toBe(1);
    recorder.reset();
    r.render([]);
    // Render drained the queue; gl.deleteVertexArray + 2x gl.deleteBuffer fired,
    // and they came BEFORE gl.clear (so no draw runs against half-deleted state).
    const names = recorder.calls.map((c) => c.name);
    const idxClear = names.indexOf('clear');
    const idxFirstDelete = names.findIndex(
      (n) => n === 'deleteVertexArray' || n === 'deleteBuffer',
    );
    expect(idxFirstDelete).toBeGreaterThanOrEqual(0);
    expect(idxFirstDelete).toBeLessThan(idxClear);
    expect(cache._pendingDeleteCount()).toBe(0);
  });

  it('reinitializes after webglcontextrestored', () => {
    const canvas = makeFakeCanvas();
    const r = new WeaselRenderer({ canvas, width: 100, height: 100, dpr: 1 });
    expect(r.isContextLost()).toBe(false);
    canvas.dispatchEvent('webglcontextlost');
    expect(r.isContextLost()).toBe(true);
    recorder.reset();
    canvas.dispatchEvent('webglcontextrestored');
    expect(r.isContextLost()).toBe(false);
    // New compileShader should appear in the recorded calls after restore.
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('compileShader');
  });
});

describe('dispose', () => {
  beforeEach(() => _resetProgramRegistryForTests());

  it('deletes owned GL programs and shared geometry, removes canvas listeners', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    // The solid batch takes its buffers on the first flush, not at construction.
    r.render([{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { color: '#f00' },
    }] as never);
    r.dispose();
    const names = rec.calls.map((c) => c.name);
    // 5 built-in programs: pathFill, pathFillVColor, textSdf, imageFill, gradFill
    expect(names.filter((n) => n === 'deleteProgram').length).toBeGreaterThanOrEqual(5);
    expect(names).toContain('deleteBuffer');
    // The solid batch's VAO must also be freed.
    expect(names).toContain('deleteVertexArray');
  });

  it('deletes a consumer-registered program alongside the built-ins', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    const handle = registerProgram('dispose-test-prog', '', MINIMAL_FRAG);
    r.registerProgram(handle);
    rec.reset();
    r.dispose();
    const names = rec.calls.map((c) => c.name);
    // 5 built-ins + 1 registered.
    expect(names.filter((n) => n === 'deleteProgram').length).toBeGreaterThanOrEqual(6);
  });

  it('ignores registerProgram() after dispose (does not compile into the cleared registry)', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    r.dispose();
    const handle = registerProgram('post-dispose-prog', '', MINIMAL_FRAG);
    rec.reset();
    r.registerProgram(handle);
    const names = rec.calls.map((c) => c.name);
    expect(names).not.toContain('compileShader');
    expect(names).not.toContain('linkProgram');
  });

  it('is idempotent', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    r.dispose();
    const countAfterFirst = rec.calls.filter((c) => c.name === 'deleteProgram').length;
    r.dispose();
    expect(rec.calls.filter((c) => c.name === 'deleteProgram').length).toBe(countAfterFirst);
  });

  it('removes context-loss listeners from a supplied canvas, using the same function references passed to addEventListener', () => {
    const rec = makeGLRecorder();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => rec.gl,
      addEventListener,
      removeEventListener,
    } as unknown as HTMLCanvasElement;
    const r = new WeaselRenderer({ canvas, width: 10, height: 10, dpr: 1 });
    r.dispose();

    const addedByType = new Map(addEventListener.mock.calls.map((c) => [c[0], c[1]]));
    const removedByType = new Map(removeEventListener.mock.calls.map((c) => [c[0], c[1]]));

    expect(addedByType.has('webglcontextlost')).toBe(true);
    expect(addedByType.has('webglcontextrestored')).toBe(true);
    expect(removedByType.get('webglcontextlost')).toBe(addedByType.get('webglcontextlost'));
    expect(removedByType.get('webglcontextrestored')).toBe(addedByType.get('webglcontextrestored'));
  });
});
