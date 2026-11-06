/**
 * Array uniforms written from one value, and programs recompiled when their
 * module-level source is re-registered.
 *
 * The recorder answers every `getUniformLocation` with a fresh number, so an
 * upload aimed at the right location proves only that the renderer asked for
 * that name — `array-uniforms.browser.test.ts` is what proves the pixels.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeGLRecorder, type GLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { registerProgram, _resetProgramRegistryForTests, type ShaderProgramHandle, type ShaderUniform } from './shaders/registerProgram';
import type { DrawCommand } from './DrawCommand';

function frag(decls: string, body = 'outColor = vec4(1.0);'): string {
  return `#version 300 es
precision highp float;
${decls}
out vec4 outColor;
void main() { ${body} }
`;
}

function shader(program: ShaderProgramHandle, uniforms: Record<string, ShaderUniform>): DrawCommand {
  return { kind: 'shader', program, uniforms, bounds: { x: 0, y: 0, w: 10, h: 10 } };
}

/** The location the recorder handed back for `name`, most recent first. */
function locationOf(rec: GLRecorder, name: string): unknown {
  const call = [...rec.calls].reverse().find((c) => c.name === 'getUniformLocation' && c.args[1] === name);
  if (!call) throw new Error(`nobody asked for ${name}`);
  return call.result;
}

/** Calls to `fn` since the last {@link mark}. */
function uploads(rec: GLRecorder, fn: string) {
  return rec.calls.slice(since).filter((c) => c.name === fn);
}

let since = 0;
function mark(): void { since = rec.calls.length; }

let rec: GLRecorder;
let r: WeaselRenderer;
beforeEach(() => {
  _resetProgramRegistryForTests();
  rec = makeGLRecorder();
  since = 0;
  r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
});
afterEach(() => { _resetProgramRegistryForTests(); });

describe('array uniforms', () => {
  it('uploads a Float32Array to the array base in one call', () => {
    const h = registerProgram('arr-vec3', { glsl: { frag: frag('uniform vec3 u_ripples[8];') } });
    r.registerProgram(h);
    const data = new Float32Array(24).map((_, i) => i);
    mark();
    r.render([shader(h, { u_ripples: data })]);

    const calls = uploads(rec, 'uniform3fv');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(locationOf(rec, 'u_ripples[0]'));
    expect(Array.from(calls[0].args[1] as Float32Array)).toEqual(Array.from(data));
  });

  it('asks for the base slot of an array declared in the vertex stage', () => {
    const vert = `#version 300 es
in vec2 a_position;
uniform vec2 u_offsets[4];
void main() { gl_Position = vec4(a_position + u_offsets[0], 0.0, 1.0); }
`;
    mark();
    r.registerProgram(registerProgram('arr-vert', { glsl: { vert: vert, frag: frag('') } }));
    const asked = uploads(rec, 'getUniformLocation').map((c) => c.args[1]);
    expect(asked).toContain('u_offsets[0]');
  });

  it('picks the upload call from the declared element type', () => {
    const h = registerProgram('arr-types', { glsl: { frag: frag(`
      uniform float u_f[4];
      uniform vec2 u_v[3];
      uniform vec4 u_c[2];
      uniform int u_i[4];
      uniform ivec2 u_iv[2];
      uniform uint u_u[2];
      uniform mat2 u_m[2];
      uniform mat4 u_m4[2];
    `) } });
    r.registerProgram(h);
    mark();
    r.render([shader(h, {
      u_f: [1, 2, 3, 4],
      u_v: [1, 2, 3, 4, 5, 6],
      u_c: new Float32Array(8),
      u_i: new Int32Array([1, 2, 3, 4]),
      u_iv: [1, 2, 3, 4],
      u_u: new Uint32Array([1, 2]),
      u_m: new Float32Array(8),
      u_m4: new Float32Array(32),
    })]);

    const one = (fn: string) => {
      const calls = uploads(rec, fn);
      expect(calls, fn).toHaveLength(1);
      return calls[0].args;
    };
    expect(one('uniform1fv')[0]).toBe(locationOf(rec, 'u_f[0]'));
    expect(one('uniform2fv')[0]).toBe(locationOf(rec, 'u_v[0]'));
    expect(one('uniform4fv')[0]).toBe(locationOf(rec, 'u_c[0]'));
    expect(one('uniform1iv')[0]).toBe(locationOf(rec, 'u_i[0]'));
    expect(one('uniform2iv')[0]).toBe(locationOf(rec, 'u_iv[0]'));
    expect(one('uniform1uiv')[0]).toBe(locationOf(rec, 'u_u[0]'));
    const m2 = one('uniformMatrix2fv');
    expect(m2[0]).toBe(locationOf(rec, 'u_m[0]'));
    expect(m2[1]).toBe(false);
    expect(one('uniformMatrix4fv')[0]).toBe(locationOf(rec, 'u_m4[0]'));
  });

  it('uploads a prefix shorter than the declared size, and nothing for an empty one', () => {
    const h = registerProgram('arr-short', { glsl: { frag: frag('uniform vec3 u_ripples[8];') } });
    r.registerProgram(h);
    mark();
    r.render([shader(h, { u_ripples: [1, 2, 3, 4, 5, 6] })]);
    expect((uploads(rec, 'uniform3fv')[0].args[1] as number[]).length).toBe(6);

    mark();
    r.render([shader(h, { u_ripples: new Float32Array(0) })]);
    expect(uploads(rec, 'uniform3fv')).toHaveLength(0);
  });

  it('rejects a value longer than the declaration or not a whole number of elements', () => {
    const h = registerProgram('arr-bad', { glsl: { frag: frag('uniform vec3 u_ripples[8];') } });
    r.registerProgram(h);
    expect(() => r.render([shader(h, { u_ripples: new Float32Array(27) })])).toThrow(/u_ripples.*vec3\[8\]/);
    expect(() => r.render([shader(h, { u_ripples: new Float32Array(7) })])).toThrow(/multiple of 3/);
  });

  it('still writes one slot through its own key', () => {
    const h = registerProgram('arr-slot', { glsl: { frag: frag('uniform vec3 u_ripples[8];') } });
    r.registerProgram(h);
    mark();
    r.render([shader(h, { 'u_ripples[2]': [1, 2, 3] })]);
    const calls = uploads(rec, 'uniform3fv');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(locationOf(rec, 'u_ripples[2]'));
  });
});

describe('re-registered program source', () => {
  const FRAG_A = frag('uniform float u_a;', 'outColor = vec4(u_a);');
  const FRAG_B = frag('uniform float u_b;', 'outColor = vec4(u_b);');

  function createdPrograms(): unknown[] {
    return uploads(rec, 'createProgram').map((c) => c.result);
  }

  it('recompiles on the next frame, deletes the program it replaces, and draws with the new one', () => {
    const h = registerProgram('hot', { glsl: { frag: FRAG_A } });
    mark();
    r.registerProgram(h);
    const [first] = createdPrograms();
    r.render([shader(h, { u_a: 1 })]);

    registerProgram('hot', { glsl: { frag: FRAG_B } });
    mark();
    r.render([shader(h, { u_b: 0.5 })]);

    // The uploaded source carries the id output (`shaders/idOutput.ts`) after FRAG_B's own lines.
    const body = FRAG_B.slice(FRAG_B.indexOf('void main'));
    expect(uploads(rec, 'shaderSource').some((c) => String(c.args[1]).includes(body.replace('void main', 'void weasel_main')))).toBe(true);
    const [second] = createdPrograms();
    expect(second).toBeDefined();
    expect(uploads(rec, 'deleteProgram').map((c) => c.args[0])).toEqual([first]);
    expect(uploads(rec, 'useProgram').map((c) => c.args[0])).toContain(second);
    const u = uploads(rec, 'uniform1f');
    expect(u.map((c) => c.args[0])).toContain(locationOf(rec, 'u_b'));
  });

  it('does not recompile when the same source is registered again', () => {
    const h = registerProgram('hot-same', { glsl: { frag: FRAG_A } });
    r.registerProgram(h);
    r.render([shader(h, { u_a: 1 })]);
    registerProgram('hot-same', { glsl: { frag: FRAG_A } });
    mark();
    r.render([shader(h, { u_a: 1 })]);
    expect(uploads(rec, 'compileShader')).toHaveLength(0);
  });

  it('keeps drawing with the old program when the new source fails, and reports it once', () => {
    let failing = false;
    const gl = new Proxy(rec.gl, {
      get(target, prop) {
        if (prop === 'getShaderParameter' && failing) return () => false;
        return (target as unknown as Record<string | symbol, unknown>)[prop];
      },
    });
    const renderer = new WeaselRenderer({ gl, width: 10, height: 10, dpr: 1 });
    const h = registerProgram('hot-broken', { glsl: { frag: FRAG_A } });
    mark();
    renderer.registerProgram(h);
    const [first] = createdPrograms();

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    failing = true;
    registerProgram('hot-broken', { glsl: { frag: FRAG_B } });
    mark();
    renderer.render([shader(h, { u_a: 1 })]);
    renderer.render([shader(h, { u_a: 1 })]);
    failing = false;

    expect(error).toHaveBeenCalledTimes(1);
    expect(uploads(rec, 'deleteProgram').map((c) => c.args[0])).not.toContain(first);
    expect(uploads(rec, 'useProgram').map((c) => c.args[0])).toContain(first);
    error.mockRestore();
  });
});

describe('a shader command whose program this renderer has not compiled', () => {
  it('compiles it on first draw, from the module-level source', () => {
    const h = registerProgram('lazy-shader', { glsl: { frag: frag('') } });
    mark();
    r.render([shader(h, {})]);
    expect(uploads(rec, 'linkProgram')).toHaveLength(1);
    expect(uploads(rec, 'drawElements')).toHaveLength(1);
    mark();
    r.render([shader(h, {})]);
    expect(uploads(rec, 'linkProgram')).toHaveLength(0);
  });

  it('draws nothing and says so once when the id was never registered', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const never = { id: 'never-registered-shader' };
    mark();
    r.render([shader(never, {})]);
    r.render([shader(never, {})]);
    expect(uploads(rec, 'drawElements')).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
