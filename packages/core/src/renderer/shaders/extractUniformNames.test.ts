import { describe, it, expect } from 'vitest';
import { extractUniformNames as extract } from './extractUniformNames';

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

  it('ignores uniforms inside line and block comments', () => {
    const src = `
      // uniform float u_deadLine;
      /* uniform float u_deadBlock;
         uniform vec2 u_deadToo; */
      uniform float u_live; // trailing { ; comment
      uniform /* inline */ vec2 u_also;
    `;
    expect(extract(src)).toEqual(['u_live', 'u_also']);
  });

  it('collects uniforms from every preprocessor branch', () => {
    const src = `#version 300 es
      #ifdef HQ
      uniform float u_hq;
      #elif defined(MQ)
      uniform float u_mq;
      #else
      uniform vec2 u_lq;
      #endif
      #if 0
      uniform float u_never;
      #endif
    `;
    expect(extract(src)).toEqual(['u_hq', 'u_mq', 'u_lq', 'u_never']);
  });

  it('sizes an array from a #define or a const int', () => {
    expect(extract('#define N 3\nuniform vec3 u_r[N];')).toEqual(['u_r[0]', 'u_r[1]', 'u_r[2]']);
    expect(extract('const int K = 2;\nuniform float u_k[K];')).toEqual(['u_k[0]', 'u_k[1]']);
    expect(extract('uniform float u_h[0x2];')).toEqual(['u_h[0]', 'u_h[1]']);
  });

  it('takes the largest size a macro is given across branches', () => {
    const src = `
      #ifdef HQ
      #define TAPS 4
      #else
      #define TAPS 2
      #endif
      uniform float u_w[TAPS];
    `;
    expect(extract(src)).toEqual(['u_w[0]', 'u_w[1]', 'u_w[2]', 'u_w[3]']);
  });

  it('reads an array size written on the type', () => {
    expect(extract('uniform float[2] u_t;')).toEqual(['u_t[0]', 'u_t[1]']);
  });

  it('expands struct uniforms into the leaf names GL locates', () => {
    const src = `
      struct Light { vec3 pos; highp float r; };
      uniform Light u_light;
      uniform Light u_lights[2];
    `;
    expect(extract(src)).toEqual([
      'u_light.pos', 'u_light.r',
      'u_lights[0].pos', 'u_lights[0].r',
      'u_lights[1].pos', 'u_lights[1].r',
    ]);
  });

  it('expands nested structs and array members', () => {
    const src = `
      struct Falloff { float k[2]; };
      struct Light { vec3 pos; Falloff f; };
      uniform Light u_l;
    `;
    expect(extract(src)).toEqual(['u_l.pos', 'u_l.f.k[0]', 'u_l.f.k[1]']);
  });

  it('reads a struct declared inline in the uniform declaration', () => {
    expect(extract('uniform struct S { float a, b; } u_s;')).toEqual(['u_s.a', 'u_s.b']);
  });

  // A uniform block is a UBO in GLSL ES 3.00: its members are bound through a
  // buffer, not getUniformLocation, so none of them is a name to look up.
  it('excludes interface blocks, named or not', () => {
    const src = `
      layout(std140) uniform Frame { mat3 proj; vec4 tint; } frame;
      uniform Globals { float time; };
      uniform float u_after;
    `;
    expect(extract(src)).toEqual(['u_after']);
  });

  it('reports a name once when two branches declare it', () => {
    const src = `
      #ifdef A
      uniform float u_t;
      #else
      uniform float u_t;
      #endif
    `;
    expect(extract(src)).toEqual(['u_t']);
  });

  it('ignores declarations that are not uniforms', () => {
    const src = `
      precision highp float;
      in vec2 v_uv;
      out vec4 outColor;
      float helper(float x) { return x; }
      void main() { outColor = vec4(helper(v_uv.x)); }
    `;
    expect(extract(src)).toEqual([]);
  });
});
