import { describe, it, expect, beforeEach } from 'vitest';
import { createGLRecorder } from '../../testing/glRecorder';
import { ShaderCompileError } from '../../shaders/ShaderProgram';
import { WebGLDevice } from './WebGLDevice';
import { GlProgram } from './GlProgram';
import { VERT_SRC, FRAG_SRC, PATH_FILL_UNIFORMS, PATH_FILL_ATTRIBUTES } from '../../shaders/pathFill';

describe('GlProgram', () => {
  let recorder: ReturnType<typeof createGLRecorder>;
  beforeEach(() => {
    recorder = createGLRecorder();
  });

  it('compiles vertex + fragment shaders and links a program', () => {
    const prog = new GlProgram(new WebGLDevice(recorder.gl), VERT_SRC, FRAG_SRC);
    const callNames = recorder.calls.map((c) => c.name);
    expect(callNames).toContain('createShader');
    expect(callNames).toContain('shaderSource');
    expect(callNames).toContain('compileShader');
    expect(callNames).toContain('createProgram');
    expect(callNames).toContain('attachShader');
    expect(callNames).toContain('linkProgram');
    expect(prog.handle).toBeTruthy();
  });

  it('binds a_position to location 0 before it links', () => {
    // Mesh VAOs are built once and drawn with every fill program, so the
    // attribute cannot sit wherever each program's linker happened to put it.
    const prog = new GlProgram(new WebGLDevice(recorder.gl), VERT_SRC, FRAG_SRC);
    const bind = recorder.calls.findIndex((c) => c.name === 'bindAttribLocation');
    const link = recorder.calls.findIndex((c) => c.name === 'linkProgram');
    expect(bind).toBeGreaterThanOrEqual(0);
    expect(recorder.calls[bind].args).toEqual([prog.handle, 0, 'a_position']);
    expect(bind).toBeLessThan(link);
  });

  it('looks up uniform locations by name', () => {
    const prog = new GlProgram(new WebGLDevice(recorder.gl), VERT_SRC, FRAG_SRC);
    prog.lookupUniforms(PATH_FILL_UNIFORMS);
    for (const name of PATH_FILL_UNIFORMS) {
      expect(prog.has(name)).toBe(true);
    }
  });

  it('looks up attribute locations by name', () => {
    const prog = new GlProgram(new WebGLDevice(recorder.gl), VERT_SRC, FRAG_SRC);
    prog.lookupAttributes(PATH_FILL_ATTRIBUTES);
    for (const name of PATH_FILL_ATTRIBUTES) {
      expect(prog.attribute(name)).toBeDefined();
    }
  });

  it('throws ShaderCompileError when compile reports failure', () => {
    // A stage that fails to compile fails the link too.
    const failingGl = new Proxy(recorder.gl, {
      get(target, prop) {
        if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => false;
        if (prop === 'getShaderInfoLog') return () => 'ERROR: fake compile error';
        return Reflect.get(target, prop);
      },
    });
    expect(() => new GlProgram(new WebGLDevice(failingGl), VERT_SRC, FRAG_SRC)).toThrow(
      expect.objectContaining({ stage: 'vertex' }),
    );
  });
});

describe('GlProgram on a lost context', () => {
  it('reports no compile error, which a valid shader did not have, and draws nothing', () => {
    const recorder = createGLRecorder();
    const lost = new Proxy(recorder.gl, {
      get(target, prop) {
        if (prop === 'isContextLost') return () => true;
        if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => null;
        if (prop === 'getShaderInfoLog' || prop === 'getProgramInfoLog') return () => null;
        return Reflect.get(target, prop);
      },
    });
    const prog = new GlProgram(new WebGLDevice(lost), VERT_SRC, FRAG_SRC);
    expect(() => prog.settle()).not.toThrow();
    expect(prog.has('u_color')).toBe(false);
    expect(recorder.calls.map((c) => c.name)).not.toContain('deleteProgram');
  });
});

describe('GlProgram compiling in the background', () => {
  const COMPLETION_STATUS_KHR = 0x91b1;
  let recorder: ReturnType<typeof createGLRecorder>;
  let done: boolean | null;
  let linkFails: boolean;
  let gl: WebGL2RenderingContext;
  beforeEach(() => {
    recorder = createGLRecorder();
    done = false;
    linkFails = false;
    gl = new Proxy(recorder.gl, {
      get(target, prop) {
        if (prop === 'getProgramParameter') {
          return (p: WebGLProgram, pname: number) => {
            recorder.calls.push({ name: 'getProgramParameter', args: [p, pname], result: undefined });
            return pname === COMPLETION_STATUS_KHR ? done : !linkFails;
          };
        }
        if (prop === 'getProgramInfoLog') return () => 'ERROR: fake link error';
        return Reflect.get(target, prop);
      },
    });
  });
  const host = () => ({ gl, completionStatus: COMPLETION_STATUS_KHR, use() {} });
  const named = (name: string) => recorder.calls.filter((c) => c.name === name);

  it('waits on nothing until a location is read', () => {
    const prog = new GlProgram(host(), VERT_SRC, FRAG_SRC);
    prog.lookupUniforms(PATH_FILL_UNIFORMS);
    expect(named('getProgramParameter')).toHaveLength(0);
    expect(named('getUniformLocation')).toHaveLength(0);
    expect(prog.has(PATH_FILL_UNIFORMS[0])).toBe(true);
    expect(named('getUniformLocation').length).toBeGreaterThan(0);
  });

  it('flushes after the link, so the compile starts before the next call that syncs', () => {
    new GlProgram(host(), VERT_SRC, FRAG_SRC);
    const link = recorder.calls.findIndex((c) => c.name === 'linkProgram');
    expect(recorder.calls.findIndex((c, i) => i > link && c.name === 'flush')).toBeGreaterThan(link);
  });

  it('reports ready only once the driver says the link is complete', () => {
    const prog = new GlProgram(host(), VERT_SRC, FRAG_SRC);
    prog.lookupUniforms(PATH_FILL_UNIFORMS);
    expect(prog.ready()).toBe(false);
    expect(named('getUniformLocation')).toHaveLength(0);
    done = true;
    expect(prog.ready()).toBe(true);
    expect(named('getUniformLocation').length).toBeGreaterThan(0);
  });

  it('reports ready when the driver gives no completion status, as a lost or restored context does', () => {
    const prog = new GlProgram(host(), VERT_SRC, FRAG_SRC);
    prog.lookupUniforms(PATH_FILL_UNIFORMS);
    done = null;
    expect(prog.ready()).toBe(true);
    expect(prog.has(PATH_FILL_UNIFORMS[0])).toBe(true);
  });

  it('answers an attribute whose location the source gives without waiting for the link', () => {
    const prog = new GlProgram(host(), VERT_SRC, FRAG_SRC, { attributes: { a_position: 0, a_uv: 2, a_post: 3 } });
    expect([prog.attribute('a_position'), prog.attribute('a_uv'), prog.attribute('a_post')]).toEqual([0, 2, 3]);
    expect(named('getProgramParameter')).toHaveLength(0);
    expect(named('getAttribLocation')).toHaveLength(0);
  });

  it('throws a failed link at the first use, and at every use after', () => {
    linkFails = true;
    const prog = new GlProgram(host(), VERT_SRC, FRAG_SRC);
    expect(() => prog.has('u_color')).toThrow(expect.objectContaining({ stage: 'link' }));
    expect(() => prog.settle()).toThrow(ShaderCompileError);
  });

  it('frees both stages of a program deleted before its link was waited on', () => {
    const parallel = new Proxy(gl, {
      get(target, prop) {
        if (prop === 'getExtension') return (name: string) => (name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR } : null);
        return Reflect.get(target, prop) as unknown;
      },
    });
    const gpu = new WebGLDevice(parallel);
    const prog = gpu.createProgram({ glsl: { vert: VERT_SRC, frag: FRAG_SRC } }) as GlProgram;
    const shaders = named('createShader').map((c) => c.result);
    gpu.deleteProgram(prog);
    expect(named('deleteShader').map((c) => c.args[0])).toEqual(shaders);
    expect(named('deleteProgram').map((c) => c.args[0])).toEqual([prog.handle]);
  });
});
