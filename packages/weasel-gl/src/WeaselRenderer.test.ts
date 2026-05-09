import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';

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
    expect(blendFuncCall.args).toEqual([recorder.gl.SRC_ALPHA, recorder.gl.ONE_MINUS_SRC_ALPHA]);
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
    const canvas = { width: 0, height: 0, getContext: () => recorder.gl } as unknown as HTMLCanvasElement;
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
