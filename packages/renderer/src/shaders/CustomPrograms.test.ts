import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GpuDevice } from '../gpu/types';
import type { ShaderProgram } from './ShaderProgram';
import { CustomPrograms } from './CustomPrograms';
import { programSourceRegistry, registerProgram, _resetProgramRegistryForTests } from './registerProgram';

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

describe('CustomPrograms.ensure', () => {
  beforeEach(() => _resetProgramRegistryForTests());

  it('warns once for a program id nothing registered', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const programs = new CustomPrograms(device().gpu);
    expect(programs.ensure('never-registered')).toBeNull();
    expect(programs.ensure('never-registered')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('"never-registered"');
    warn.mockRestore();
  });
});

const OTHER = FRAG.replace('vec4(1.0)', 'vec4(0.5)');

/** A device counting compiles and deletes, whose compiles fail for a source
 *  holding `BROKEN` and, while `lost` holds, for every source. */
function countingDevice() {
  const state = { lost: false, made: [] as object[], deleted: [] as object[] };
  const gpu = {
    language: 'glsl',
    createProgram: (src: { glsl: { frag: string } }) => {
      if (state.lost || src.glsl.frag.includes('BROKEN')) throw new Error('compile failed');
      const program = { lookupUniforms() {}, lookupUniformArrays() {}, lookupAttributes() {} };
      state.made.push(program);
      return program as unknown as ShaderProgram;
    },
    deleteProgram: (p: object) => { state.deleted.push(p); },
  } as unknown as GpuDevice;
  return { gpu, state };
}

describe('CustomPrograms re-registration', () => {
  beforeEach(() => {
    _resetProgramRegistryForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('compiles nothing again for a program already built from its registered source', () => {
    const { gpu, state } = countingDevice();
    const programs = new CustomPrograms(gpu);
    registerProgram('fx', { glsl: { frag: FRAG } });
    programs.register('fx');
    const epoch = programs.epoch;
    programs.register('fx');
    expect(state.made).toHaveLength(1);
    expect(state.deleted).toHaveLength(0);
    expect(programs.epoch).toBe(epoch);
  });

  it('still throws from register for a re-registered source that failed to recompile', () => {
    const { gpu } = countingDevice();
    const programs = new CustomPrograms(gpu);
    registerProgram('fx', { glsl: { frag: FRAG } });
    programs.register('fx');
    registerProgram('fx', { glsl: { frag: `${FRAG}// BROKEN\n` } }, { replace: true });
    programs.refresh();
    expect(() => programs.register('fx')).toThrow();
  });

  it('drops and deletes a compiled program once its source is released', () => {
    const { gpu, state } = countingDevice();
    const programs = new CustomPrograms(gpu);
    const release = programSourceRegistry.register('fx', { glsl: { frag: FRAG } });
    const compiled = programs.ensure('fx');
    expect(compiled).not.toBeNull();
    const epoch = programs.epoch;
    release();
    programs.refresh();
    expect(programs.registry.has('fx')).toBe(false);
    expect(state.deleted).toContain(compiled);
    expect(programs.epoch).toBeGreaterThan(epoch);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(programs.ensure('fx')).toBeNull();
  });

  it('keeps drawing the previous source across a context restore when the re-registered one fails', () => {
    const { gpu, state } = countingDevice();
    const programs = new CustomPrograms(gpu);
    registerProgram('fx', { glsl: { frag: OTHER } });
    expect(programs.ensure('fx')).not.toBeNull();
    registerProgram('fx', { glsl: { frag: `${FRAG}// BROKEN\n` } }, { replace: true });
    programs.refresh();
    expect(programs.ensure('fx')).toBe(state.made[0]);
    programs.restore();
    expect(programs.ensure('fx')).toBe(state.made[1]);
  });
});
