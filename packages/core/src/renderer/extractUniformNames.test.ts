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

  // A precision qualifier is the common spelling in hand-written GLSL, and it
  // used to match nothing — the uniform got no location and every write to it
  // was dropped without a word.
  it('skips precision and interpolation qualifiers', () => {
    expect(extract('uniform highp float u_t;')).toEqual(['u_t']);
    expect(extract('uniform mediump vec2 u_res;')).toEqual(['u_res']);
    expect(extract('uniform lowp vec4 u_c[2];')).toEqual(['u_c[0]', 'u_c[1]']);
  });

  it('reads a comma-separated declarator list', () => {
    expect(extract('uniform float a, b;')).toEqual(['a', 'b']);
    expect(extract('uniform highp vec2 p, q[2];')).toEqual(['p', 'q[0]', 'q[1]']);
  });

  it('handles matrix arrays and layout qualifiers', () => {
    expect(extract('uniform mat3 u_xforms[2];')).toEqual(['u_xforms[0]', 'u_xforms[1]']);
    expect(extract('layout(location = 0) uniform float u_t;')).toEqual(['u_t']);
  });
});
