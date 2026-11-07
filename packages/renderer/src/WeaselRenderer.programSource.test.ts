/** Which language's source a WebGL renderer draws a program from, and what it does without one. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import {
  registerProgram, sameProgramSource, getProgramSource, _resetProgramRegistryForTests, type ShaderProgramHandle,
} from './shaders/registerProgram';
import { registerEffect } from './effects/types';
import { EFFECT_VERT_SRC } from './effects/effectPrelude';
import { assembleEffectWgsl } from './gpu/webgpu/wgsl/effectPrelude';
import type { DrawCommand } from './DrawCommand';

const GLSL = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }
`;
const WGSL = '@fragment fn main() -> @location(0) vec4f { return vec4f(1.0); }';

function shader(program: ShaderProgramHandle): DrawCommand {
  return { kind: 'shader', program, uniforms: {}, bounds: { x: 0, y: 0, w: 10, h: 10 } };
}

describe('a program registered in GLSL, WGSL or both', () => {
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    _resetProgramRegistryForTests();
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    error.mockRestore();
    warn.mockRestore();
  });

  it('refuses a registration with no source in either language', () => {
    expect(() => registerProgram('none', {} as never)).toThrow(/no source/);
    expect(() => registerEffect('none-effect', {} as never)).toThrow(/no source/);
  });

  it('compiles the GLSL of a program that carries WGSL beside it', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    const h = registerProgram('both', { glsl: { frag: GLSL }, wgsl: { frag: WGSL } });
    rec.reset();
    r.render([shader(h)]);
    const sources = rec.calls.filter((c) => c.name === 'shaderSource').map((c) => c.args[1] as string);
    expect(sources.some((s) => s.includes('outColor = vec4(1.0);'))).toBe(true);
    expect(sources.some((s) => s.includes('@fragment'))).toBe(false);
    expect(rec.calls.some((c) => c.name === 'drawElements')).toBe(true);
  });

  it('draws nothing for a WGSL-only program, compiles nothing, and says so once across frames', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    const h = registerProgram('wgsl-only', { wgsl: { frag: WGSL } });
    rec.reset();
    r.render([shader(h)]);
    r.render([shader(h)]);
    const names = rec.calls.map((c) => c.name);
    expect(names).not.toContain('compileShader');
    expect(names).not.toContain('drawElements');
    const said = error.mock.calls.map((args: unknown[]) => String(args[0])).filter((m: string) => m.includes('wgsl-only'));
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/no GLSL source/);
  });

  it('throws from an ahead-of-time compile of a WGSL-only program', () => {
    const r = new WeaselRenderer({ gl: makeGLRecorder().gl, width: 10, height: 10, dpr: 1 });
    expect(() => r.registerProgram(registerProgram('wgsl-ahead', { wgsl: { frag: WGSL } }))).toThrow(/no GLSL source/);
  });

  it('compiles a WGSL-only program once GLSL is registered for it', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 10, height: 10, dpr: 1 });
    const h = registerProgram('wgsl-then-glsl', { wgsl: { frag: WGSL } });
    r.render([shader(h)]);
    registerProgram('wgsl-then-glsl', { glsl: { frag: GLSL }, wgsl: { frag: WGSL } });
    rec.reset();
    r.render([shader(h)]);
    expect(rec.calls.some((c) => c.name === 'drawElements')).toBe(true);
  });

  it('puts the effect vertex stage under an effect’s GLSL, and its WGSL inside the effect prelude', () => {
    registerEffect('fx', { glsl: GLSL, wgsl: WGSL });
    expect(getProgramSource('fx')).toEqual({ glsl: { vert: EFFECT_VERT_SRC, frag: GLSL }, wgsl: { frag: assembleEffectWgsl(WGSL) } });
  });

  it('compares sources language by language', () => {
    const a = { glsl: { frag: GLSL } };
    expect(sameProgramSource(a, { glsl: { frag: GLSL } })).toBe(true);
    expect(sameProgramSource(a, { glsl: { frag: GLSL }, wgsl: { frag: WGSL } })).toBe(false);
    expect(sameProgramSource(a, { glsl: { vert: 'v', frag: GLSL } })).toBe(false);
  });
});
