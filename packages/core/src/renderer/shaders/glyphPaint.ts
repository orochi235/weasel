/**
 * GLSL ES 3.0 sources for atlas glyphs filled by a texture paint — a pattern, a
 * gradient or a registered kind — rather than one color.
 *
 * **The glyph is a mask over the paint.** The fragment takes its coverage from
 * the distance field exactly as the batch program does, and its color from the
 * same `shadePaint` the path program for that paint runs, at the same
 * paint-space point: `u_worldInv` applied to the screen position. An outline
 * glyph is a path, so it goes through that path program — which is what makes
 * a paint read the same on either side of the outline-tier threshold.
 *
 * **The vertices are the batch's.** A glyph run stages into `DrawBatch` as
 * usual and this program draws it in place of the batch program, so the
 * attribute locations are pinned to the batch shader's and one VAO serves
 * both. Positions arrive already in screen space, so `u_model` is identity.
 *
 * Coverage is taken before `shadePaint` runs, and outside any branch: `fwidth`
 * in non-uniform control flow is undefined. The gradient's branches are on a
 * uniform, so they could not make it so, but the order keeps it from mattering.
 *
 * Output: PREMULTIPLIED alpha, the paint's own scaled by coverage.
 */

import { GLYPH_COVERAGE_GLSL } from '@weasel-js/font';
import { BATCH_ATTRIBUTE_LOCATIONS, BATCH_TEXTURE_SLOTS } from './batchFill';
import { GRAD_FILL_UNIFORMS, GRAD_PAINT_GLSL } from './gradFill';
import { PATTERN_FILL_UNIFORMS, PATTERN_PAINT_GLSL } from './patternFill';

const L = BATCH_ATTRIBUTE_LOCATIONS;

export const GLYPH_PAINT_VERT_SRC = /* glsl */ `#version 300 es
layout(location = ${L.a_position}) in vec2 a_position;
layout(location = ${L.a_uv}) in vec2 a_uv;
layout(location = ${L.a_texSlot}) in float a_texSlot;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform mat3 u_worldInv;
out vec2 v_world;
out vec2 v_uv;
flat out float v_glyphMode;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_world = (u_worldInv * vec3(screen.xy, 1.0)).xy;
  v_uv = a_uv;
  v_glyphMode = float(int(a_texSlot + 0.5) / ${BATCH_TEXTURE_SLOTS});
}
`;

function fragSrc(paintGlsl: string): string {
  return /* glsl */ `#version 300 es
precision highp float;
in vec2 v_world;
in vec2 v_uv;
flat in float v_glyphMode;
uniform sampler2D u_atlas;
uniform float u_synthBold;
${paintGlsl}
${GLYPH_COVERAGE_GLSL}
out vec4 outColor;
void main() {
  float coverage = glyphCoverage(texture(u_atlas, v_uv), v_glyphMode, u_synthBold);
  outColor = shadePaint(v_world) * coverage;
}
`;
}

/**
 * A registered paint kind binds a whole program of its own, which nothing can
 * wrap in a mask, so it renders into an offscreen buffer first and the glyphs
 * sample that. `u_worldInv` takes the screen position straight to the
 * buffer's texture coordinate, and the texel is already premultiplied and
 * faded — the kind's own program did both.
 */
const TEXTURE_PAINT_GLSL = /* glsl */ `
uniform sampler2D u_sampler;
vec4 shadePaint(vec2 uv) {
  return texture(u_sampler, uv);
}
`;

export const GLYPH_PATTERN_FRAG_SRC = fragSrc(PATTERN_PAINT_GLSL);
export const GLYPH_GRAD_FRAG_SRC = fragSrc(GRAD_PAINT_GLSL);
export const GLYPH_TEXTURE_FRAG_SRC = fragSrc(TEXTURE_PAINT_GLSL);

const GLYPH_UNIFORMS = ['u_atlas', 'u_synthBold'] as const;
export const GLYPH_PATTERN_UNIFORMS = [...PATTERN_FILL_UNIFORMS, ...GLYPH_UNIFORMS] as const;
export const GLYPH_GRAD_UNIFORMS = [...GRAD_FILL_UNIFORMS, ...GLYPH_UNIFORMS] as const;
export const GLYPH_TEXTURE_UNIFORMS = [
  'u_proj', 'u_model', 'u_worldInv', 'u_sampler', ...GLYPH_UNIFORMS,
] as const;
export const GLYPH_PAINT_ATTRIBUTES = ['a_position', 'a_uv', 'a_texSlot'] as const;
