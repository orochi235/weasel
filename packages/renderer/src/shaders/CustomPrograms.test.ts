import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GpuDevice } from '../gpu/types';
import type { ShaderProgram } from './ShaderProgram';
import { CustomPrograms } from './CustomPrograms';
import { registerProgram, _resetProgramRegistryForTests } from './registerProgram';

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }
`;

/** A device whose compiles fail while `lost` holds, as a lost context's do. */
function device() {
  const state = { lost: false, made: [] as object[] };
  const gpu = {
    language: 'glsl',
    createProgram: () => {
      if (state.lost) throw new Error('compile failed: context lost');
      const program = { lookupUniforms() {}, lookupUniformArrays() {}, lookupAttributes() {} };
      state.made.push(program);
      return program as unknown as ShaderProgram;
    },
    deleteProgram: () => {},
  } as unknown as GpuDevice;
  return { gpu, state };
}

describe('CustomPrograms on a restored context', () => {
  beforeEach(() => {
    _resetProgramRegistryForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // A frame drawn after the context was lost but before its event arrived
  // fails every compile: that says nothing about the source.
  it('compiles a program again that failed while the context was being lost', () => {
    const { gpu, state } = device();
    const programs = new CustomPrograms(gpu);
    registerProgram('fx', { glsl: { frag: FRAG } });
    state.lost = true;
    expect(programs.ensure('fx')).toBeNull();
    state.lost = false;
    programs.restore();
    expect(programs.ensure('fx')).toBe(state.made[0]);
  });

  it('hands out no program from the lost context when its recompile fails', () => {
    const { gpu, state } = device();
    const programs = new CustomPrograms(gpu);
    registerProgram('fx', { glsl: { frag: FRAG } });
    const dead = programs.ensure('fx');
    expect(dead).not.toBeNull();
    state.lost = true;
    programs.restore();
    expect(programs.ensure('fx')).toBeNull();
    expect(programs.registry.has('fx')).toBe(false);
  });
});
