import { mat3 } from '@weasel-js/geom';
import type { DeviceRect } from '../retain/contentBounds';
import type { ShaderUniform } from '../shaders/registerProgram';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { GpuTexture } from '../gpu/types';
import type { DrawContext } from './drawContext';
import { drawTriangles, type DrawOptions } from './drawTriangles';
import { quadGeometry } from './quad';
import { setColorMatrixUniforms } from './uniforms';
import { setUniforms } from './customShader';

/** End an offscreen pass and resume the one `ctx.renderTarget` names, or
 *  the canvas's. */
export function returnToRenderTarget(ctx: DrawContext): void {
  const gpu = ctx.gpu;
  gpu.endPass();
  const pass = ctx.renderTarget ? ctx.renderTarget.pass : ctx.canvasPass;
  if (pass) gpu.beginPass(pass);
}

/** How a full-screen pass is drawn beyond its source. */
export interface QuadPass {
  readonly uniforms?: Record<string, ShaderUniform>;
  readonly composite?: { alpha: number; colorMatrix: Float32Array };
  readonly programId?: string;
  readonly windowOrigin?: readonly [number, number];
  readonly draw?: DrawOptions;
}

/** One pass: the kit quad, `u_source` sampling `texture`, and whatever else
 *  the caller supplies. */
export function drawFullscreenQuad(
  ctx: DrawContext, program: ShaderProgram, texture: GpuTexture, width: number, height: number,
  pass: QuadPass = {},
): void {
  const geometry = quadGeometry(ctx, program);
  if (!geometry) return;
  program.setTexture('u_source', texture);
  program.set2f('u_resolution', width, height);
  program.set2f('u_texel', 1 / width, 1 / height);
  program.set2f('u_windowOrigin', pass.windowOrigin?.[0] ?? 0, pass.windowOrigin?.[1] ?? 0);

  const { composite } = pass;
  if (composite) {
    program.set1f('u_alpha', composite.alpha);
    setColorMatrixUniforms(ctx, program, composite.colorMatrix);
  }

  if (pass.uniforms) setUniforms(ctx, program, pass.programId ?? 'effect', pass.uniforms);

  drawTriangles(ctx, program, geometry, 6, pass.draw);
}

/** Draw `texture` over `rect` of the drawing buffer, device pixels, into the
 *  target `ctx.renderTarget` names, then put that target's viewport back. */
export function compositeOver(
  ctx: DrawContext, program: ShaderProgram, texture: GpuTexture, rect: DeviceRect,
  composite: { alpha: number; colorMatrix: Float32Array }, draw?: DrawOptions,
): void {
  const height = ctx.deviceHeight!;
  const target = ctx.renderTarget ?? null;
  const [ox, oy] = (target ? target.fragOrigin : ctx.fragOrigin) ?? [0, 0];
  const gpu = ctx.gpu;
  gpu.setViewport({ x: ox + rect.x, y: oy + height - rect.y - rect.height, width: rect.width, height: rect.height });
  drawFullscreenQuad(ctx, program, texture, rect.width, rect.height, { composite, draw });
  const pass = target ? target.pass : ctx.canvasPass;
  if (pass) gpu.setViewport(pass.viewport);
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
