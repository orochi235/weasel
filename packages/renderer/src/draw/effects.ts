import { mat3 } from '@weasel-js/geom';
import type { DeviceRect } from '../retain/contentBounds';
import type { ShaderUniform } from '../shaders/registerProgram';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { setColorMatrixUniforms } from './uniforms';
import { setUniforms } from './customShader';

/** Rebind `ctx.renderTarget` after an offscreen pass: a pooled target takes
 *  the whole `width` × `height` buffer, the default framebuffer the renderer's
 *  own rect and the scissor it had. */
export function returnToRenderTarget(
  ctx: DrawContext, width: number, height: number, scissorWasOn: boolean,
): void {
  const gl = ctx.gl;
  const target = ctx.renderTarget ?? null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
  if (target) {
    if (target.restore) target.restore();
    else gl.viewport(0, 0, width, height);
  } else {
    ctx.restoreTargetRect?.();
    if (scissorWasOn) gl.enable(gl.SCISSOR_TEST);
  }
}

/** One pass: the kit quad, `u_source` bound to `texture`, and whatever else
 *  the caller supplies. Leaves no attribute arrays or buffers bound. */
export function drawFullscreenQuad(
  ctx: DrawContext,
  program: ShaderProgram,
  texture: WebGLTexture,
  width: number,
  height: number,
  uniforms?: Record<string, ShaderUniform>,
  composite?: { alpha: number; colorMatrix: Float32Array },
  programId?: string,
): void {
  const gl = ctx.gl;
  gl.useProgram(program.handle);

  const aPos = program.attribute('a_position');
  const aUv = program.attribute('a_uv');
  gl.bindBuffer(gl.ARRAY_BUFFER, ctx.quadVbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ctx.quadIbo);
  if (aPos !== undefined && aPos >= 0) {
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  }
  if (aUv !== undefined && aUv >= 0) {
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const source = program.uniform('u_source');
  if (source !== undefined) gl.uniform1i(source, 0);
  const resolution = program.uniform('u_resolution');
  if (resolution !== undefined) gl.uniform2f(resolution, width, height);
  const texel = program.uniform('u_texel');
  if (texel !== undefined) gl.uniform2f(texel, 1 / width, 1 / height);

  if (composite) {
    const alpha = program.uniform('u_alpha');
    if (alpha !== undefined) gl.uniform1f(alpha, composite.alpha);
    setColorMatrixUniforms(ctx, program, composite.colorMatrix);
  }

  // Unit 0 is `u_source`; a consumer texture starts above it.
  if (uniforms) setUniforms(gl, program, programId ?? 'effect', uniforms, ctx.textureCache, { value: 1 });

  drawTriangles(ctx, 6, ctx.gl.UNSIGNED_SHORT);

  if (aPos !== undefined && aPos >= 0) gl.disableVertexAttribArray(aPos);
  if (aUv !== undefined && aUv >= 0) gl.disableVertexAttribArray(aUv);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

/** Draw `texture` over `rect` of the drawing buffer, device pixels, into the
 *  target `ctx.renderTarget` names, then put that target's viewport back. */
export function compositeOver(
  ctx: DrawContext, program: ShaderProgram, texture: WebGLTexture, rect: DeviceRect,
  composite: { alpha: number; colorMatrix: Float32Array },
): void {
  const gl = ctx.gl;
  const width = ctx.deviceWidth!;
  const height = ctx.deviceHeight!;
  const target = ctx.renderTarget ?? null;
  const [ox, oy] = (target ? target.fragOrigin : ctx.fragOrigin) ?? [0, 0];
  gl.viewport(ox + rect.x, oy + height - rect.y - rect.height, rect.width, rect.height);
  drawFullscreenQuad(ctx, program, texture, rect.width, rect.height, undefined, composite);
  if (!target) ctx.restoreTargetRect?.();
  else if (target.restore) target.restore();
  else gl.viewport(0, 0, width, height);
}

/** Screen→clip aimed at `rect`, device pixels, of a buffer `scale` device
 *  pixels to the CSS pixel. */
export function windowProjection(rect: DeviceRect, scale: number): Float32Array {
  const toClip = mat3.screenToClip(rect.width / scale, rect.height / scale);
  return mat3.toUniform(mat3.translated(toClip, -rect.x / scale, -rect.y / scale));
}

/** Whether `rect` lies inside a `width × height` drawing buffer. */
export function insideBuffer(rect: DeviceRect, width: number, height: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height;
}
