import { describe, expect, it } from 'vitest';
import { getProgramSource } from '@weasel-js/renderer';
import { assembleCustomWgsl, createUniformBlock, reflectWgsl } from '@weasel-js/renderer/testing/wgsl';
import { SHADERS, VORONOI_PROGRAM } from '../customShaderPrograms';

describe('customShaderPrograms', () => {
  // A browser without uniform_buffer_standard_layout refuses a uniform array whose stride is not 16.
  it.each(SHADERS.map((p) => [p.id]))('%s keeps the strict uniform layout', (id) => {
    const wgsl = getProgramSource(id)?.wgsl;
    expect(wgsl).toBeDefined();
    expect(() => reflectWgsl(assembleCustomWgsl(wgsl!), { standardLayout: false })).not.toThrow();
  });

  it('fills the voronoi seeds from the same flat list the GLSL program takes', () => {
    const r = reflectWgsl(assembleCustomWgsl(getProgramSource(VORONOI_PROGRAM.id)!.wgsl!), { standardLayout: false });
    const block = createUniformBlock(r, 'Params');
    block.set('u_seeds', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect([...new Float32Array(block.bytes, 0, 6)].map((v) => +v.toFixed(3))).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  });
});
