/** How a group drawn into a buffer of its own hands its ids to its parent. */
import { EFFECT_VERT_SRC } from '../effects/effectPrelude';
import { ID_COMPOSITE_WGSL } from '../gpu/webgpu/wgsl/idComposite';
import { NO_PICK_ID, checkPickId, idChannels } from '../shaders/idOutput';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { GpuDevice, GpuStencilState, GpuTexture } from '../gpu/types';
import type { DeviceRect } from '../retain/contentBounds';
import type { DrawContext } from './drawContext';
import { compositeOver } from './effects';
import type { IdFrame } from './idFrame';

/**
 * Hand a group's ids back to its parent after its color composited: every
 * pixel the composite claims takes the id the group's children wrote there,
 * or, where an effect painted past them, the group's own, unless the group
 * carries none. A pixel it does not claim keeps the parent's.
 */
export function compositeIds(
  ctx: DrawContext, ids: IdFrame, color: GpuTexture, own: GpuTexture, rect: DeviceRect,
  alpha: number, groupId: number, stencil: GpuStencilState | null,
): void {
  const program = ids.composite;
  const claims = groupId !== NO_PICK_ID;
  if (claims) checkPickId(groupId);
  program.setTexture('u_ids', own);
  // A negative red channel says the group carries no id of its own.
  const [r, g, b]: [number, number, number] = claims ? idChannels(groupId) : [-1, 0, 0];
  program.set4f('u_groupId', r, g, b, ids.minAlpha);
  compositeOver(ctx, program, color, rect, { alpha, colorMatrix: IDENTITY }, { stencil, colorWrite: false, ids: true });
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
  o_id = vec4(0.0);
  if (claims) {
    if (inner.a > 0.5) o_id = inner;
    else if (u_groupId.r >= 0.0) o_id = vec4(u_groupId.rgb, 1.0);
  }
}
`;

/** The id composite's program, compiled on `gpu`. */
export function createIdComposite(gpu: GpuDevice): ShaderProgram {
  const program = gpu.createProgram(
    { glsl: { vert: EFFECT_VERT_SRC, frag: ID_COMPOSITE_FRAG }, wgsl: ID_COMPOSITE_WGSL }, { ids: false },
  );
  program.lookupUniforms(['u_source', 'u_ids', 'u_resolution', 'u_alpha', 'u_groupId']);
  program.lookupAttributes(['a_position', 'a_uv']);
  return program;
}
