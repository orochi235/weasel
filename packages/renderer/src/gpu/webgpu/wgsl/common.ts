/** Pieces the kit's WGSL programs are assembled from. */

/**
 * Element types for a uniform array whose GLSL element is a `float` or a
 * `vec2`: WGSL's uniform address space wants a 16-byte array stride, so each
 * element sits in a struct padded to 16. Read one as `u.u_alpha[i].v`; set
 * the array by its GLSL name, flat, as GL takes it.
 */
const SLOT_STRUCTS: Readonly<Record<string, string>> = {
  F32Slot: 'struct F32Slot { @size(16) v: f32 }',
  Vec2Slot: 'struct Vec2Slot { @size(16) v: vec2f }',
};

/**
 * `struct Uniforms` at `@group(0) @binding(0)` as `u`, holding `members`
 * (`name: type` each, the GLSL uniform names) and, where `ids` is on,
 * `u_weaselId`. A member named twice is declared once.
 */
export function uniformsWgsl(members: readonly string[], ids = true): string {
  const seen = new Map<string, string>();
  for (const m of [...members, ...(ids ? ['u_weaselId: vec4f'] : [])]) {
    const name = m.slice(0, m.indexOf(':')).trim();
    if (!seen.has(name)) seen.set(name, m.trim());
  }
  const body = [...seen.values()];
  const slots = Object.entries(SLOT_STRUCTS)
    .filter(([name]) => body.some((m) => m.includes(`<${name},`)))
    .map(([, decl]) => `${decl}\n`)
    .join('');
  return `${slots}struct Uniforms {\n${body.map((m) => `  ${m},`).join('\n')}\n}
@group(0) @binding(0) var<uniform> u: Uniforms;
`;
}

/** A group-1 texture `name` at `binding`, beside its sampler at `binding + 1`. */
export function textureWgsl(name: string, binding: number): string {
  return `@group(1) @binding(${binding}) var ${name}: texture_2d<f32>;
@group(1) @binding(${binding + 1}) var ${name}_sampler: sampler;
`;
}

/** What a path program's vertex stage reads. */
export const PATH_VERTEX_MEMBERS = ['u_proj: mat3x3f', 'u_model: mat3x3f', 'u_origin: vec2f'] as const;

/** A path vertex in screen space, and a screen point in clip space. */
export const PATH_VERTEX_WGSL = /* wgsl */ `
fn screenOf(a_position: vec2f) -> vec2f {
  return (u.u_model * vec3f(a_position - u.u_origin, 1.0)).xy;
}

fn clipOf(screen: vec2f) -> vec4f {
  let clip = u.u_proj * vec3f(screen, 1.0);
  return vec4f(clip.xy, 0.0, 1.0);
}
`;

/** The members `shadeMapped` reads. */
export const COLOR_MATRIX_MEMBERS = ['u_colorMatrix: mat4x4f', 'u_colorBias: vec4f', 'u_alpha: f32'] as const;

/** A straight color through the color matrix and `u_alpha`, premultiplied. */
export const SHADE_MAPPED_WGSL = /* wgsl */ `
fn shadeMapped(src: vec4f) -> vec4f {
  let mapped = saturate(u.u_colorMatrix * src + u.u_colorBias);
  let a = mapped.a * u.u_alpha;
  return vec4f(mapped.rgb * a, a);
}
`;

/** The color of a premultiplied image texel, straight, as `STRAIGHT_RGB_GLSL`. */
export const STRAIGHT_RGB_WGSL = /* wgsl */ `
fn straightRgb(premultiplied: vec4f) -> vec3f {
  return premultiplied.rgb / max(premultiplied.a, 0.0001);
}
`;
