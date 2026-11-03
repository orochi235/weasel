/** How a group drawn into a buffer of its own hands its ids to its parent. */
import { ShaderProgram } from '../shaders/ShaderProgram';
import { EFFECT_VERT_SRC } from '../effects/effectPrelude';
import { checkPickId, idChannels } from '../shaders/idOutput';
import type { DeviceRect } from '../retain/contentBounds';
import type { DrawContext } from './drawContext';
import { compositeOver } from './effects';
import { drawBoth, type IdFrame } from './idFrame';

/**
 * Hand a group's ids back to its parent after its color composited: every
 * pixel the composite claims takes the id the group's children wrote there,
 * or, where an effect painted past them, the group's own. A pixel it does not
 * claim keeps the parent's.
 */
export function compositeIds(
  ctx: DrawContext, ids: IdFrame, color: WebGLTexture, own: WebGLTexture, rect: DeviceRect,
  alpha: number, groupId: number,
): void {
  const gl = ctx.gl;
  const program = ids.composite;
  checkPickId(groupId);
  gl.useProgram(program.handle);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, own);
  const unit = program.uniform('u_ids');
  if (unit !== undefined) gl.uniform1i(unit, 1);
  const group = program.uniform('u_groupId');
  if (group !== undefined) gl.uniform4f(group, ...idChannels(groupId), ids.minAlpha);
  gl.activeTexture(gl.TEXTURE0);
  gl.drawBuffers([gl.NONE, gl.COLOR_ATTACHMENT1]);
  compositeOver(ctx, program, color, rect, { alpha, colorMatrix: IDENTITY });
  drawBoth(gl);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);

const ID_COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_ids;
uniform vec2 u_resolution;
uniform float u_alpha;
uniform vec4 u_groupId;
layout(location = 1) out highp vec4 o_id;

void main() {
  float a = texture(u_source, v_uv).a * u_alpha;
  vec4 inner = texelFetch(u_ids, ivec2(v_uv * u_resolution), 0);
  bool claims = a > 0.0 && a >= u_groupId.a;
  o_id = claims ? (inner.a > 0.5 ? inner : vec4(u_groupId.rgb, 1.0)) : vec4(0.0);
}
`;

/** The id composite's program, compiled against `gl`. */
export function createIdComposite(gl: WebGL2RenderingContext): ShaderProgram {
  const program = new ShaderProgram(gl, EFFECT_VERT_SRC, ID_COMPOSITE_FRAG, { ids: false });
  program.lookupUniforms(['u_source', 'u_ids', 'u_resolution', 'u_alpha', 'u_groupId']);
  program.lookupAttributes(['a_position', 'a_uv']);
  return program;
}
