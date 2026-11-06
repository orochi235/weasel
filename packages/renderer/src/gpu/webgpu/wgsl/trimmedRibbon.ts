import { pathFillCommonWgsl } from './pathFill';

/** `shaders/trimmedRibbon.ts` in WGSL: the solid path program, discarding
 *  what lies outside `u_trim`. */
export const TRIMMED_RIBBON_WGSL = /* wgsl */ `${pathFillCommonWgsl(['u_trim: vec2f'])}
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) v_length: f32,
  @location(1) @interpolate(flat) v_span: vec3f,
}

@vertex fn vs(@location(0) a_position: vec2f, @location(1) a_trim: vec4f) -> VOut {
  var o: VOut;
  o.position = clipOf(screenOf(a_position));
  o.v_length = a_trim.x;
  o.v_span = a_trim.yzw;
  return o;
}

fn trimmedAway(len: f32, span: vec3f) -> bool {
  let inside = len >= u.u_trim.x && len <= u.u_trim.y;
  let whole = u.u_trim.x <= span.x && span.y <= u.u_trim.y;
  if (span.z < 0.5) { return !inside; }
  if (span.z < 1.5) { return !whole; }
  return !inside || whole;
}

@fragment fn fs(in: VOut) -> WeaselOut {
  if (trimmedAway(in.v_length, in.v_span)) { discard; }
  return weasel_out(shadeMapped(u.u_color), u.u_weaselId);
}
`;

export const TRIMMED_RIBBON_LOCATIONS = { a_position: 0, a_trim: 1 } as const;
