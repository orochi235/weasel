/**
 * The text layer's program: atlas glyphs kept on the GPU as one instance a
 * glyph, placed by the vertex stage, so a frame that only moves the camera
 * changes a uniform and nothing else (`draw/textLayer.ts`).
 *
 * The vertex stage is `placeGlyph` (`glyphCorners.ts`) on the GPU: corners, the
 * synthetic oblique, the glyph's own turn, the transform, and the growth a
 * glyph small enough for area coverage takes. The fragment stage is the
 * batch's, under one color matrix and no hull, so a glyph inks exactly as the
 * batch inks it.
 *
 * Instance attributes, four floats each:
 *   a_rect    x0 y0 x1 y1, the quad in the layer's space, before the oblique
 *   a_uvRect  u0 v0 u1 v1
 *   a_pen     baseline y, pen x, and the turn's cos and sin
 *   a_color   straight-alpha color
 *   a_glyph   slot + 16 * mode (`packSlot`), synthetic-bold shift, tan of the oblique, unused
 * Per vertex, `a_corner` is 0 to 3: top left, top right, bottom right, bottom left.
 */

import { GLYPH_AREA_FROM, GLYPH_AREA_MARGIN } from '@weasel-js/font';
import { BATCH_TEXTURE_SLOTS, batchFragSrc } from './batchFill';

export const GLYPH_LAYER_LOCATIONS = {
  a_corner: 0, a_rect: 1, a_uvRect: 2, a_pen: 3, a_color: 4, a_glyph: 5,
} as const;

/** Floats an instance takes. */
export const GLYPH_INSTANCE_FLOATS = 20;

const L = GLYPH_LAYER_LOCATIONS;

/** `glyphNeedsArea`'s threshold, which the vertex stage applies per glyph. */
const NEEDS_AREA = (GLYPH_AREA_FROM * 0.9).toFixed(6);

function glyphLayerVertSrc(area: boolean): string {
  return /* glsl */ `#version 300 es
layout(location = ${L.a_corner}) in float a_corner;
layout(location = ${L.a_rect}) in vec4 a_rect;
layout(location = ${L.a_uvRect}) in vec4 a_uvRect;
layout(location = ${L.a_pen}) in vec4 a_pen;
layout(location = ${L.a_color}) in vec4 a_color;
layout(location = ${L.a_glyph}) in vec4 a_glyph;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform float u_devicePx;
uniform vec2 u_fieldScale[${BATCH_TEXTURE_SLOTS}];
out vec4 v_vertexColor;
out vec2 v_uv;
out float v_post;
flat out int v_texSlot;
flat out float v_paintMode;
flat out int v_matrix;${area ? '\nout vec2 v_cell;' : ''}

// Corner k of rect r, leaned about the baseline and turned about the pen, then
// mapped through u_model.
vec2 corner(vec4 r, int k) {
  float x = (k == 1 || k == 2) ? r.z : r.x;
  float y = k >= 2 ? r.w : r.y;
  x += (a_pen.x - y) * a_glyph.z;
  vec2 d = vec2(x - a_pen.y, y - a_pen.x);
  vec2 p = vec2(a_pen.y + d.x * a_pen.z - d.y * a_pen.w, a_pen.x + d.x * a_pen.w + d.y * a_pen.z);
  return (u_model * vec3(p, 1.0)).xy;
}

void main() {
  int k = int(a_corner + 0.5);
  int packed = int(a_glyph.x + 0.5);
  v_texSlot = packed % ${BATCH_TEXTURE_SLOTS};
  v_paintMode = float(packed / ${BATCH_TEXTURE_SLOTS});
  v_matrix = 0;
  v_vertexColor = a_color;
  v_post = a_glyph.y;
  vec4 r = a_rect;
  vec4 t = a_uvRect;${area ? `
  vec2 size = r.zw - r.xy;
  vec2 uvSize = t.zw - t.xy;
  float pxPerU = length(u_model[0].xy) * u_devicePx * size.x / abs(uvSize.x);
  float pxPerV = length(u_model[1].xy) * u_devicePx * size.y / abs(uvSize.y);
  vec2 field = u_fieldScale[v_texSlot];
  v_cell = vec2(0.0);
  if (0.5 * (field.x / pxPerU + field.y / pxPerV) > ${NEEDS_AREA}) {
    // The quad's top and left edges on screen: the transform's linear part of the turned edges.
    mat2 lr = mat2(u_model[0].xy, u_model[1].xy) * mat2(a_pen.z, a_pen.w, -a_pen.w, a_pen.z);
    vec2 top = lr * vec2(size.x, 0.0);
    vec2 side = lr * vec2(-size.y * a_glyph.z, size.y);
    float span = abs(top.x * side.y - top.y * side.x);
    if (span > 0.0) {
      float grow = ${GLYPH_AREA_MARGIN.toFixed(1)} / u_devicePx;
      vec2 g = grow * size * vec2(length(side), length(top)) / span;
      r += vec4(-g, g);
      vec2 dt = uvSize * g / size;
      t += vec4(-dt, dt);
      v_cell = vec2((k == 1 || k == 2) ? 1.0 : 0.0, k >= 2 ? 1.0 : 0.0);
    }
  }` : ''}
  v_uv = vec2((k == 1 || k == 2) ? t.z : t.x, k >= 2 ? t.w : t.y);
  vec3 clip = u_proj * vec3(corner(r, k), 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
`;
}

export const GLYPH_LAYER_VERT_SRC = glyphLayerVertSrc(false);
export const GLYPH_LAYER_AREA_VERT_SRC = glyphLayerVertSrc(true);
export const GLYPH_LAYER_FRAG_SRC = batchFragSrc(1);
export const GLYPH_LAYER_AREA_FRAG_SRC = batchFragSrc(1, false, true);

export const GLYPH_LAYER_UNIFORMS = [
  'u_proj', 'u_model', 'u_devicePx', 'u_samplers', 'u_color', 'u_alpha', 'u_fieldScale', 'u_colorMatrix', 'u_colorBias',
] as const;

export const GLYPH_LAYER_ATTRIBUTES = Object.keys(GLYPH_LAYER_LOCATIONS);
