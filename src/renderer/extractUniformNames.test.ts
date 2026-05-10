import { describe, it, expect } from 'vitest';
import { _extractUniformNamesForTests as extract } from './WeaselRenderer';

describe('extractUniformNames', () => {
  it('extracts scalar/vector uniforms', () => {
    const src = `
      uniform float u_time;
      uniform vec2  u_mouse;
      uniform sampler2D u_image;
    `;
    const names = extract(src);
    expect(names).toContain('u_time');
    expect(names).toContain('u_mouse');
    expect(names).toContain('u_image');
  });

  it('expands array uniforms into per-slot names', () => {
    const src = `uniform vec2 u_seeds[8];`;
    const names = extract(src);
    expect(names).toContain('u_seeds[0]');
    expect(names).toContain('u_seeds[7]');
    expect(names).not.toContain('u_seeds');
    expect(names).toHaveLength(8);
  });

  it('handles mixed scalar + array declarations', () => {
    const src = `
      uniform float u_time;
      uniform vec3 u_ripples[8];
      uniform float u_rippleCount;
    `;
    const names = extract(src);
    expect(names).toContain('u_time');
    expect(names).toContain('u_rippleCount');
    expect(names).toContain('u_ripples[0]');
    expect(names).toContain('u_ripples[7]');
  });
});
