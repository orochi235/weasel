import { describe, expect, it } from 'vitest';
import { reflectWgsl } from './wgslReflect';
import { createUniformBlock } from './wgslUniforms';

const STANDARD = { standardLayout: true };
const STRICT = { standardLayout: false };

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
    const r = reflectWgsl(SRC, STANDARD);
    expect([...r.structs.keys()]).toEqual(['Uniforms']);
    const s = r.structs.get('Uniforms')!;
    expect(s.members.map((m) => [m.name, m.offset])).toEqual([
      ['u_proj', 0], ['u_alpha', 48], ['u_origin', 56], ['u_color', 64],
      ['u_alphas', 80], ['u_hull', 112], ['u_kind', 144], ['u_model', 160],
    ]);
    expect(s.size).toBe(224);
  });

  it('finds bindings by group and kind', () => {
    expect(reflectWgsl(SRC, STANDARD).bindings).toEqual([
      { group: 0, binding: 0, name: 'u', kind: 'uniform', struct: 'Uniforms' },
      { group: 1, binding: 1, name: 'u_tex', kind: 'texture' },
      { group: 1, binding: 2, name: 'u_tex_sampler', kind: 'sampler' },
    ]);
  });

  it('keeps a 16-byte slot struct at a 16-byte stride', () => {
    const src = 'struct F32Slot { @size(16) v: f32 } struct U { a: array<F32Slot, 4>, b: f32 } @group(1) @binding(0) var<uniform> u: U;';
    expect(reflectWgsl(src, STRICT).structs.get('U')!.members.map((m) => m.offset)).toEqual([0, 64]);
  });
});

// The demo's voronoi seeds, and a nested struct, which only uniform_buffer_standard_layout accepts in a uniform.
const RELAXED = `
struct In { a: f32 }
struct Params { x: f32, inner: In, y: f32, seeds: array<vec2f, 8>, t: f32 }
@group(1) @binding(0) var<uniform> params: Params;
`;

describe('uniform layout with and without uniform_buffer_standard_layout', () => {
  it('lays a uniform struct out as a storage one is where the browser has the feature', () => {
    const out = reflectWgsl(RELAXED, STANDARD).structs.get('Params')!;
    expect(out.members.map((m) => m.offset)).toEqual([0, 4, 8, 16, 80]);
    expect(out.members[3].type).toMatchObject({ kind: 'array', stride: 8 });
    expect([out.align, out.size]).toEqual([8, 88]);
  });

  it('refuses it, naming the member, where the browser lacks the feature', () => {
    expect(() => reflectWgsl(RELAXED, STRICT)).toThrow(/params\.inner is at offset 4/);
    expect(() => reflectWgsl(RELAXED.replace('inner: In,', '@align(16) inner: In,'), STRICT)).toThrow(/after struct params\.inner/);
    const arrayOnly = 'struct P { s: array<vec2f, 8>, t: f32 } @group(1) @binding(0) var<uniform> p: P;';
    expect(() => reflectWgsl(arrayOnly, STRICT)).toThrow(/p\.s has an array stride of 8/);
  });

  it('lays a struct valid under both out the same either way', () => {
    const src = SRC.replace('array<f32, N>', 'array<vec4f, N>');
    expect(reflectWgsl(src, STRICT).structs.get('Uniforms')).toEqual(reflectWgsl(src, STANDARD).structs.get('Uniforms'));
  });

  it('holds no struct to the uniform rules that no uniform binds', () => {
    expect(() => reflectWgsl('struct In { a: f32 } struct S { x: f32, inner: In }', STRICT)).not.toThrow();
  });
});

describe('createUniformBlock', () => {
  const r = reflectWgsl(SRC, STANDARD);

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
