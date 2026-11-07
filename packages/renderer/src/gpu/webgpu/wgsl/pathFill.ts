import { COLOR_MATRIX_MEMBERS, PATH_VERTEX_MEMBERS, PATH_VERTEX_WGSL, SHADE_MAPPED_WGSL, uniformsWgsl } from './common';
import { ID_OUT_WGSL } from './idOut';

export const PATH_FILL_MEMBERS = [...PATH_VERTEX_MEMBERS, ...COLOR_MATRIX_MEMBERS, 'u_color: vec4f'] as const;

/** The flat program's module scope, for a program extending it with members of its own. */
export function pathFillCommonWgsl(extra: readonly string[] = []): string {
  return `${uniformsWgsl([...PATH_FILL_MEMBERS, ...extra])}${ID_OUT_WGSL}${PATH_VERTEX_WGSL}${SHADE_MAPPED_WGSL}`;
}

/** The solid-fill path program in WGSL, flat and per-vertex-color, with the
 *  GLSL's uniform names. Output is premultiplied. */
export const PATH_FILL_WGSL = /* wgsl */ `${pathFillCommonWgsl()}
@vertex fn vs(@location(0) a_position: vec2f) -> @builtin(position) vec4f {
  return clipOf(screenOf(a_position));
}

@fragment fn fs() -> WeaselOut {
  return weasel_out(shadeMapped(u.u_color), u.u_weaselId);
}
`;

export const PATH_FILL_LOCATIONS = { a_position: 0 } as const;

export const PATH_FILL_VCOLOR_WGSL = /* wgsl */ `${pathFillCommonWgsl()}
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) vertexColor: vec4f,
}

@vertex fn vs(@location(0) a_position: vec2f, @location(1) a_vertexColor: vec4f) -> VOut {
  var o: VOut;
  o.position = clipOf(screenOf(a_position));
  o.vertexColor = a_vertexColor;
  return o;
}

@fragment fn fs(in: VOut) -> WeaselOut {
  return weasel_out(shadeMapped(u.u_color * in.vertexColor), u.u_weaselId);
}
`;

export const PATH_FILL_VCOLOR_LOCATIONS = { a_position: 0, a_vertexColor: 1 } as const;
