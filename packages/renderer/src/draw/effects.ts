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
