import { describe, expect, it } from 'vitest';
import { reflectWgsl } from './wgslReflect';
import { reflectEntries } from './wgslEntries';
import { declaresEntryPoints } from './wgsl/customPrelude';
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

  it('refuses a texture or sampler the kit cannot bind, naming it, rather than laying it out as a float texture_2d', () => {
    for (const type of ['texture_2d<u32>', 'texture_depth_2d', 'texture_multisampled_2d<f32>', 'texture_cube<f32>', 'sampler_comparison']) {
      expect(() => reflectWgsl(`@group(1) @binding(0) var t: ${type};`, STANDARD), type).toThrow(`t is a ${type}`);
    }
    expect(reflectWgsl('@group(1) @binding(0) var t: texture_storage_2d<rgba8unorm, write>;', STANDARD).bindings[0].kind).toBe('storage');
    expect(reflectWgsl('@group(1) @binding(0) var t: texture_2d< f32 >;', STANDARD).bindings[0].kind).toBe('texture');
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

  it('reads past a struct no uniform binds whose members a uniform cannot hold', () => {
    const src = `
struct Hit { t: f32, ok: bool }
struct FragIn { @builtin(position) pos: vec4f, @builtin(front_facing) front: bool }
struct Rays { n: u32, dirs: array<vec2f> }
struct U { a: f32 }
@group(1) @binding(0) var<uniform> u: U;`;
    const r = reflectWgsl(src, STANDARD);
    expect(r.structs.get('U')!.size).toBe(4);
    expect(r.bindings).toEqual([{ group: 1, binding: 0, name: 'u', kind: 'uniform', struct: 'U' }]);
  });

  it('still refuses a uniform struct holding one, naming the type', () => {
    const src = 'struct Hit { t: f32, ok: bool } struct U { h: Hit } @group(1) @binding(0) var<uniform> u: U;';
    expect(() => reflectWgsl(src, STANDARD)).toThrow(/unsupported type bool/);
  });

  it('reads an i-suffixed literal as an array size and a const', () => {
    const src = 'const N = 3i; struct U { a: array<vec4f, 2i>, b: array<vec4f, N> } @group(1) @binding(0) var<uniform> u: U;';
    expect(reflectWgsl(src, STANDARD).structs.get('U')!.members.map((m) => m.offset)).toEqual([0, 32]);
  });
});

describe('reflectWgsl on comments and literals WGSL allows', () => {
  it('skips a nested block comment whole, and a line comment holding a block opener', () => {
    const src = `
/* old: /* note */ @group(1) @binding(0) var<uniform> p: Old; */
// a stray /* here
struct U { a: vec4f }
@group(0) @binding(0) var<uniform> u: U;
`;
    expect(reflectWgsl(src, STANDARD).bindings.map((b) => b.name)).toEqual(['u']);
  });

  it('takes an entry point inside a nested comment for no entry point', () => {
    expect(declaresEntryPoints('/* old /* note */ @vertex fn vertex() {} */ fn fragment() {}')).toBe(false);
  });

  it('reads a hex literal as an array size and a const', () => {
    const src = `
const N = 0x2u;
struct U { a: array<vec4f, N>, b: array<vec4f, 0x10> }
@group(0) @binding(0) var<uniform> u: U;
`;
    const s = reflectWgsl(src, STANDARD).structs.get('U')!;
    expect(s.size).toBe(16 * 18);
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

  it('lays out a struct named like an Object.prototype member as that struct, not a scalar', () => {
    const src = `
struct toString { a: vec4f, b: f32 }
struct Uniforms { inner: toString, after: f32 }
@group(0) @binding(0) var<uniform> u: Uniforms;
`;
    const s = reflectWgsl(src, STANDARD).structs.get('Uniforms')!;
    expect(s.members.map((m) => [m.name, m.type, m.offset])).toEqual([
      ['inner', { kind: 'struct', name: 'toString' }, 0], ['after', { kind: 'scalar', scalar: 'f32' }, 32],
    ]);
  });
});

describe('reflectWgsl on a module declaring things after their use', () => {
  it('binds a uniform written above its struct, sized by a const below it, holding a struct declared last', () => {
    const r = reflectWgsl(`
@group(1) @binding(0) var<uniform> params: Params;
struct Params { inner: Inner, weights: array<vec4f, N> }
const N = 4;
struct Inner { a: vec4f }
`, STANDARD);
    expect(r.bindings).toEqual([{ group: 1, binding: 0, name: 'params', kind: 'uniform', struct: 'Params' }]);
    expect(r.structs.get('Params')!.size).toBe(80);
    expect(createUniformBlock(r, 'Params').size).toBe(80);
  });

  it('still refuses a uniform whose struct cannot be laid out, naming why', () => {
    expect(() => reflectWgsl(`
@group(1) @binding(0) var<uniform> params: Params;
struct Params { inner: Mid }
struct Mid { inner: Inner }
struct Inner { flag: bool }
`, STANDARD)).toThrow(/bool/);
  });
});

describe('reflectWgsl on @align and @size arguments', () => {
  it('reads a suffixed literal, a hex literal, and a const', () => {
    const s = reflectWgsl(`
const A = 32;
struct P { @size(16u) a: f32, @align(0x10) b: f32, @align(A) c: f32 }
@group(1) @binding(0) var<uniform> p: P;
`, STANDARD).structs.get('P')!;
    expect(s.members.map((m) => m.offset)).toEqual([0, 16, 32]);
    expect(s.size).toBe(64);
  });

  it('refuses an argument it cannot read, naming it', () => {
    expect(() => reflectWgsl(`
struct P { @size(2 * 8) a: f32 }
@group(1) @binding(0) var<uniform> p: P;
`, STANDARD)).toThrow(/@size\(2 \* 8\)/);
  });
});

describe('reflectWgsl on a const declared inside a function', () => {
  it('sizes a uniform array by the module-scope const of that name', () => {
    const r = reflectWgsl(`
const N = 8;
struct P { w: array<vec4f, N> }
@group(1) @binding(0) var<uniform> p: P;
fn f() -> f32 { const N = 2; return f32(N); }
`, STANDARD);
    expect(r.structs.get('P')!.size).toBe(128);
  });
});

describe('reflectWgsl on a uniform of a plain type', () => {
  it('lays it out as one member named for the variable', () => {
    const r = reflectWgsl(`
@group(1) @binding(1) var<uniform> tint: vec4f;
@group(1) @binding(2) var<uniform> weights: array<vec4f, 2>;
`, STANDARD);
    const [tint, weights] = r.bindings;
    expect(tint).toMatchObject({ name: 'tint', kind: 'uniform' });
    const block = createUniformBlock(r, tint.struct!);
    expect(block.size).toBe(16);
    expect(block.has('tint')).toBe(true);
    expect(createUniformBlock(r, weights.struct!).size).toBe(32);
  });

  it('refuses one it cannot lay out, naming the binding', () => {
    expect(() => reflectWgsl('@group(1) @binding(1) var<uniform> on: bool;', STANDARD)).toThrow(/uniform on: .*bool/);
  });
});

describe('a WGSL attribute given by a const or with spaces', () => {
  it('places a binding at the group and slot it names', () => {
    const r = reflectWgsl([
      'const TEX = 1;',
      'const GROUP: u32 = 0x1u;',
      '@group(GROUP) @binding(TEX) var u_tex: texture_2d<f32>;',
      '@group( 1 ) @binding (2) var u_tex_sampler: sampler;',
    ].join('\n'), STANDARD);
    expect(r.bindings.map((b) => [b.name, b.group, b.binding])).toEqual([['u_tex', 1, 1], ['u_tex_sampler', 1, 2]]);
  });

  it('refuses one it cannot read rather than leaving it out of the layout', () => {
    expect(() => reflectWgsl('@group(1) @binding(MISSING) var t: texture_2d<f32>;', STANDARD)).toThrow(/cannot read @binding/);
    expect(() => reflectWgsl('@group(1) var t: texture_2d<f32>;', STANDARD)).toThrow(/needs both @group and @binding/);
  });

  it('reads a vertex input and a fragment output at the location it names', () => {
    const e = reflectEntries([
      'const UV = 2;',
      'struct In { @location( 0 ) a_position: vec2f, @location(UV) uv: vec2f }',
      '@vertex fn vs(v: In, @location (3) a_post: f32) -> @builtin(position) vec4f { return vec4f(v.a_position, 0.0, 1.0); }',
      '@fragment fn fs() -> @location( 0 ) vec4f { return vec4f(1.0); }',
    ].join('\n'));
    expect([...e.attributes]).toEqual(expect.arrayContaining([['a_position', 0], ['a_uv', 2], ['a_post', 3]]));
    expect([...e.inputs].sort()).toEqual([0, 2, 3]);
    expect([...e.outputs]).toEqual([0]);
  });
});
