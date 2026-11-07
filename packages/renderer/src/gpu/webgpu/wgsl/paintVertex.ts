import { PATH_VERTEX_MEMBERS, PATH_VERTEX_WGSL } from './common';
import { ID_OUT_WGSL } from './idOut';

/** The vertex stage every paint drawn over a path shares, gradients, patterns
 *  and the mesh: the path's vertex in clip space, and `u_worldInv` of its
 *  screen point as the paint-space point `v_world`. */
export const PAINT_VERTEX_MEMBERS = [...PATH_VERTEX_MEMBERS, 'u_worldInv: mat3x3f'] as const;

export const PAINT_VERTEX_WGSL = /* wgsl */ `${ID_OUT_WGSL}${PATH_VERTEX_WGSL}
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) v_world: vec2f,
}

@vertex fn vs(@location(0) a_position: vec2f) -> VOut {
  var o: VOut;
  let screen = screenOf(a_position);
  o.position = clipOf(screen);
  o.v_world = (u.u_worldInv * vec3f(screen, 1.0)).xy;
  return o;
}
`;

export const PAINT_FILL_LOCATIONS = { a_position: 0 } as const;

/** What a paint's fragment stage is made of, so the glyph program can mask
 *  the same paint the path program draws. */
export interface WgslPaint {
  /** Its members of `struct Uniforms`. */
  readonly members: readonly string[];
  /** `fn shadePaint(world: vec2f) -> vec4f`, premultiplied, and the group-1
   *  textures it samples, at bindings 0 and 1. */
  readonly code: string;
}
