import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { ShaderProgram, ShaderCompileError } from './ShaderProgram';
import { VERT_SRC, FRAG_SRC, PATH_FILL_UNIFORMS, PATH_FILL_ATTRIBUTES } from './shaders/pathFill';

describe('ShaderProgram', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => {
    recorder = makeGLRecorder();
  });

  it('compiles vertex + fragment shaders and links a program', () => {
    const prog = new ShaderProgram(recorder.gl, VERT_SRC, FRAG_SRC);
    const callNames = recorder.calls.map((c) => c.name);
    expect(callNames).toContain('createShader');
    expect(callNames).toContain('shaderSource');
    expect(callNames).toContain('compileShader');
    expect(callNames).toContain('createProgram');
    expect(callNames).toContain('attachShader');
    expect(callNames).toContain('linkProgram');
    expect(prog.handle).toBeTruthy();
  });

  it('looks up uniform locations by name', () => {
    const prog = new ShaderProgram(recorder.gl, VERT_SRC, FRAG_SRC);
    prog.lookupUniforms(PATH_FILL_UNIFORMS);
    for (const name of PATH_FILL_UNIFORMS) {
      expect(prog.uniform(name)).toBeDefined();
    }
  });

  it('looks up attribute locations by name', () => {
    const prog = new ShaderProgram(recorder.gl, VERT_SRC, FRAG_SRC);
    prog.lookupAttributes(PATH_FILL_ATTRIBUTES);
    for (const name of PATH_FILL_ATTRIBUTES) {
      expect(prog.attribute(name)).toBeDefined();
    }
  });

  it('throws ShaderCompileError when compile reports failure', () => {
    // Override getShaderParameter to return false → compile failed.
    const failingGl = new Proxy(recorder.gl, {
      get(target, prop) {
        if (prop === 'getShaderParameter') return () => false;
        if (prop === 'getShaderInfoLog') return () => 'ERROR: fake compile error';
        return Reflect.get(target, prop);
      },
    });
    expect(() => new ShaderProgram(failingGl, VERT_SRC, FRAG_SRC)).toThrow(ShaderCompileError);
  });
});
