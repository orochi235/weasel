import { GLYPH_AREA_FROM, GLYPH_AREA_MARGIN } from '@weasel-js/font';
import { BATCH_TEXTURE_SLOTS } from '../../../shaders/batchFill';
import { GLYPH_LAYER_LOCATIONS } from '../../../shaders/glyphLayer';
import { batchModuleWgsl } from './batchFill';

/** The text layer's program (`shaders/glyphLayer.ts`) in WGSL: its vertex
 *  stage, beside the batch's fragment stage under one matrix and no hull. */

const L = GLYPH_LAYER_LOCATIONS;
const NEEDS_AREA = (GLYPH_AREA_FROM * 0.9).toFixed(6);

function vertexWgsl(area: boolean): string {
  return /* wgsl */ `
struct VIn {
  @location(${L.a_corner}) a_corner: f32,
  @location(${L.a_rect}) a_rect: vec4f,
  @location(${L.a_uvRect}) a_uvRect: vec4f,
  @location(${L.a_pen}) a_pen: vec4f,
  @location(${L.a_color}) a_color: vec4f,
  @location(${L.a_glyph}) a_glyph: vec4f,
}

fn corner(v: VIn, r: vec4f, k: i32) -> vec2f {
  var x = select(r.x, r.z, k == 1 || k == 2);
  let y = select(r.y, r.w, k >= 2);
  x += (v.a_pen.x - y) * v.a_glyph.z;
  let d = vec2f(x - v.a_pen.y, y - v.a_pen.x);
  let p = vec2f(v.a_pen.y + d.x * v.a_pen.z - d.y * v.a_pen.w, v.a_pen.x + d.x * v.a_pen.w + d.y * v.a_pen.z);
  return (u.u_model * vec3f(p, 1.0)).xy;
}

@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  let k = i32(v.a_corner + 0.5);
  let packed = i32(v.a_glyph.x + 0.5);
  o.v_texSlot = packed % ${BATCH_TEXTURE_SLOTS};
  o.v_paintMode = f32(packed / ${BATCH_TEXTURE_SLOTS});
  o.v_matrix = 0;
  o.v_vertexColor = v.a_color;
  o.v_post = v.a_glyph.y;
  var r = v.a_rect;
  var t = v.a_uvRect;${area ? `
  let size = r.zw - r.xy;
  let uvSize = t.zw - t.xy;
  let pxPerU = length(u.u_model[0].xy) * u.u_devicePx * size.x / abs(uvSize.x);
  let pxPerV = length(u.u_model[1].xy) * u.u_devicePx * size.y / abs(uvSize.y);
  let field = u.u_fieldScale[o.v_texSlot].v;
  o.v_cell = vec2f(0.0);
  if (0.5 * (field.x / pxPerU + field.y / pxPerV) > ${NEEDS_AREA}) {
    let lr = mat2x2f(u.u_model[0].xy, u.u_model[1].xy) * mat2x2f(v.a_pen.z, v.a_pen.w, -v.a_pen.w, v.a_pen.z);
    let top = lr * vec2f(size.x, 0.0);
    let side = lr * vec2f(-size.y * v.a_glyph.z, size.y);
    let span = abs(top.x * side.y - top.y * side.x);
    if (span > 0.0) {
      let grow = ${GLYPH_AREA_MARGIN.toFixed(1)} / u.u_devicePx;
      let g = grow * size * vec2f(length(side), length(top)) / span;
      r += vec4f(-g, g);
      let dt = uvSize * g / size;
      t += vec4f(-dt, dt);
      o.v_cell = vec2f(select(0.0, 1.0, k == 1 || k == 2), select(0.0, 1.0, k >= 2));
    }
  }` : ''}
  o.v_uv = vec2f(select(t.x, t.z, k == 1 || k == 2), select(t.y, t.w, k >= 2));
  let clip = u.u_proj * vec3f(corner(v, r, k), 1.0);
  o.position = weasel_clip(vec4f(clip.xy, 0.0, 1.0));
  return o;
}
`;
}

/** The module for the point build or the area build, entry points `vs` and `fs`. */
export function glyphLayerWgsl(area: boolean): string {
  return batchModuleWgsl({ matrices: false, hulls: false, area }, vertexWgsl(area), ['u_devicePx: f32']);
}

export const GLYPH_LAYER_WGSL_LOCATIONS = GLYPH_LAYER_LOCATIONS;
