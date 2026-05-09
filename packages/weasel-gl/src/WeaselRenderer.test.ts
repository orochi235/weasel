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
