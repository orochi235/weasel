import { describe, expect, it } from 'vitest';
import { reflectWgsl } from './wgslReflect';
import { createUniformBlock } from './wgslUniforms';

const SRC = `
const N: u32 = 8u;
// struct Commented { x: f32 }
struct Uniforms {
  u_proj: mat3x3f,      /* 0, 48 bytes */
  u_alpha: f32,         // 48
  u_origin: vec2<f32>,  // 56
  u_color: vec4f,       // 64
  u_alphas: array<f32, N>,          // 80, stride 4
  u_hull: array<vec4i, 2>,          // 112
  @align(16) u_kind: i32,           // 144
  u_model: mat4x4<f32>,             // 160
}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(1) @binding(1) var u_tex: texture_2d<f32>;
@group(1) @binding(2) var u_tex_sampler: sampler;
`;

describe('reflectWgsl', () => {
  it('lays a uniform struct out under WGSL rules', () => {
    const r = reflectWgsl(SRC);
    expect([...r.structs.keys()]).toEqual(['Uniforms']);
    const s = r.structs.get('Uniforms')!;
    expect(s.members.map((m) => [m.name, m.offset])).toEqual([
      ['u_proj', 0], ['u_alpha', 48], ['u_origin', 56], ['u_color', 64],
      ['u_alphas', 80], ['u_hull', 112], ['u_kind', 144], ['u_model', 160],
    ]);
    expect(s.size).toBe(224);
  });

  it('finds bindings by group and kind', () => {
    expect(reflectWgsl(SRC).bindings).toEqual([
      { group: 0, binding: 0, name: 'u', kind: 'uniform', struct: 'Uniforms' },
      { group: 1, binding: 1, name: 'u_tex', kind: 'texture' },
      { group: 1, binding: 2, name: 'u_tex_sampler', kind: 'sampler' },
    ]);
  });

  // No uniform-only padding: a shader that needs it fails validation, and
  // under uniform_buffer_standard_layout it is laid out exactly so.
  it('places a nested struct and an array of vec2 at their own alignment', () => {
    const r = reflectWgsl('struct In { a: f32 } struct Out { x: f32, inner: In, y: f32, seeds: array<vec2f, 8>, t: f32 }');
    const out = r.structs.get('Out')!;
    expect(out.members.map((m) => m.offset)).toEqual([0, 4, 8, 16, 80]);
    expect(out.members[3].type).toMatchObject({ kind: 'array', stride: 8 });
  });

  it('keeps a 16-byte slot struct at a 16-byte stride', () => {
    const r = reflectWgsl('struct F32Slot { @size(16) v: f32 } struct U { a: array<F32Slot, 4>, b: f32 }');
    expect(r.structs.get('U')!.members.map((m) => m.offset)).toEqual([0, 64]);
  });
});

describe('createUniformBlock', () => {
  const r = reflectWgsl(SRC);

  it('pads a column-major mat3 into three 16-byte columns', () => {
    const b = createUniformBlock(r, 'Uniforms');
    b.set('u_proj', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Array.from(new Float32Array(b.bytes, 0, 12))).toEqual([1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0]);
  });

  it('spreads a flat float array across its stride, and writes one slot by name', () => {
    const b = createUniformBlock(r, 'Uniforms');
    b.set('u_alphas', [0.5, 0.25]);
    b.set('u_alphas[3]', 2);
    const f = new Float32Array(b.bytes);
    expect([f[20], f[21], f[22], f[23]]).toEqual([0.5, 0.25, 0, 2]);
  });

  it('writes integers as integers', () => {
    const b = createUniformBlock(r, 'Uniforms');
    b.set('u_kind', 3);
    b.set('u_hull', [1, -2, 3, 4, 5, 6, 7, 8]);
    const i = new Int32Array(b.bytes);
    expect(i[36]).toBe(3);
    expect(Array.from(i.slice(28, 36))).toEqual([1, -2, 3, 4, 5, 6, 7, 8]);
  });

  it('ignores a name the struct does not declare', () => {
    const b = createUniformBlock(r, 'Uniforms');
    expect(b.set('u_missing', 1)).toBe(false);
    expect(b.has('u_color')).toBe(true);
  });
});
