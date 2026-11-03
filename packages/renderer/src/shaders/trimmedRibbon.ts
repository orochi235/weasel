/**
 * GLSL ES 3.0 sources for a solid stroke ribbon clipped to a trim.
 *
 * `a_trim` is `ClipRibbon.trim` from `@weasel-js/stroke`: the vertex's arc
 * length, the first and last length of the closed subpath it belongs to, and
 * which kind of vertex it is (0 open, 1 a closed subpath built closed, 2 one
 * opened at its seam). `u_trim` is the window of lengths drawn, ends included.
 * The fragment stage is the solid path program's.
 */
import { FRAG_SRC, PATH_FILL_UNIFORMS } from './pathFill';

export const TRIMMED_RIBBON_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec4 a_trim;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform vec2 u_origin;
out float v_length;
flat out vec3 v_span;
void main() {
  vec3 screen = u_model * vec3(a_position - u_origin, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_length = a_trim.x;
  v_span = a_trim.yzw;
}
`;

const CLIP_GLSL = /* glsl */ `
in float v_length;
flat in vec3 v_span;
uniform vec2 u_trim;
bool trimmedAway() {
  bool inside = v_length >= u_trim.x && v_length <= u_trim.y;
  bool whole = u_trim.x <= v_span.x && v_span.y <= u_trim.y;
  if (v_span.z < 0.5) return !inside;
  if (v_span.z < 1.5) return !whole;
  return !inside || whole;
}
`;

export const TRIMMED_RIBBON_FRAG_SRC = FRAG_SRC
  .replace('out vec4 outColor;', `out vec4 outColor;\n${CLIP_GLSL}`)
  .replace('void main() {', 'void main() {\n  if (trimmedAway()) discard;');

export const TRIMMED_RIBBON_UNIFORMS = [...PATH_FILL_UNIFORMS, 'u_trim'] as const;

export const TRIMMED_RIBBON_ATTRIBUTES = ['a_position', 'a_trim'] as const;
