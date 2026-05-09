import type { Stroke } from '@orochi235/weasel';
import { resolveTextStyle } from '@orochi235/weasel';
import type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
} from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache, GLMeshHandle } from './GLMeshCache';
import type { GLTextureCache } from './GLTextureCache';
import type { ShaderProgram } from './ShaderProgram';
import { mat3 } from './mat3';
import { getMesh } from './cache';
import { parseColor } from './color';
import { tessellateStroke } from './stroke';
import { getFont, ensureFontTexture } from './registerFont';
import { layoutGlyphs, quadsToVertexBuffer, buildQuadIndexBuffer } from './GlyphLayout';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  textSdf: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  state: GroupState;
  widthCss: number;
  heightCss: number;
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group': return drawGroup(ctx, cmd);
    case 'path':  return drawPath(ctx, cmd);
    case 'text':  return drawText(ctx, cmd);
  }
}

function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  ctx.state.push({ transform: cmd.transform, alpha: cmd.alpha });
  for (const child of cmd.children) dispatch(ctx, child);
  ctx.state.pop();
}

function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill && !cmd.stroke) return;

  if (cmd.fill) {
    const mesh = getMesh(cmd.path);
    const handle = ctx.meshCache.handleFor(mesh);
    if (handle.requiresStencil) {
      drawPathFillStencil(ctx, cmd.fill, handle);
    } else {
      drawPathFillSolid(ctx, cmd.fill, handle);
    }
  }

  if (cmd.stroke) {
    drawPathStroke(ctx, cmd);
  }
}

function setProjAndModel(ctx: DrawContext, prog: ShaderProgram): void {
  const gl = ctx.gl;
  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(prog.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(prog.uniform('u_model')!, false, ctx.state.transform);
}

function setSolidPaintUniforms(
  ctx: DrawContext, prog: ShaderProgram,
  color: string, opacity: number | undefined,
): void {
  const gl = ctx.gl;
  const [r, g, b, a] = parseColor(color);
  gl.uniform4f(prog.uniform('u_color')!, r, g, b, a * (opacity ?? 1));
  gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);
}

function drawPathFillSolid(ctx: DrawContext, fill: NonNullable<PathDrawCommand['fill']>, handle: GLMeshHandle): void {
  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, fill.color, fill.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathFillStencil(ctx: DrawContext, fill: NonNullable<PathDrawCommand['fill']>, handle: GLMeshHandle): void {
  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0xff);
  gl.stencilFunc(gl.ALWAYS, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  setSolidPaintUniforms(ctx, ctx.pathFill, fill.color, fill.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  if (paint.fill && paint.fill !== 'solid') {
    throw new Error('weasel-gl step 2: stroke.paint must be solid; gradient/pattern arrives in step 4');
  }

  const align = stroke.align ?? 'center';
  if (cmd.path.kind === 'polygon' && align !== 'center') {
    drawPathStrokeStenciled(ctx, cmd, align);
    return;
  }

  drawPathStrokeUnclipped(ctx, cmd);
}

function drawPathStrokeUnclipped(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const solid = stroke.paint as { color: string; opacity?: number };
  const mesh = tessellateStroke(cmd.path, stroke);
  if (mesh.indices.length === 0) return;
  const handle = ctx.meshCache.handleFor(mesh);

  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathStrokeStenciled(
  ctx: DrawContext,
  cmd: PathDrawCommand,
  align: 'inner' | 'outer',
): void {
  const stroke = cmd.stroke!;
  const solid = stroke.paint as { color: string; opacity?: number };
  const widerStroke: Stroke = { ...stroke, width: (stroke.width ?? 1) * 2, align: 'center' };

  const fillMesh = getMesh(cmd.path);
  const fillHandle = ctx.meshCache.handleFor(fillMesh);
  const ribbonMesh = tessellateStroke(cmd.path, widerStroke);
  if (ribbonMesh.indices.length === 0) return;
  const ribbonHandle = ctx.meshCache.handleFor(ribbonMesh);

  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  setProjAndModel(ctx, ctx.pathFill);

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0xff);
  gl.stencilFunc(gl.ALWAYS, 1, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.bindVertexArray(fillHandle.vao);
  gl.drawElements(gl.TRIANGLES, fillHandle.indexCount, gl.UNSIGNED_INT, 0);

  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.EQUAL, align === 'inner' ? 1 : 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  gl.bindVertexArray(ribbonHandle.vao);
  gl.drawElements(gl.TRIANGLES, ribbonHandle.indexCount, gl.UNSIGNED_INT, 0);

  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const family = style.fontFamily;

  if (!ensureFontTexture(family, ctx.textureCache)) {
    console.warn(`weasel-gl drawText: font "${family}" not registered; call registerFont() first.`);
    return;
  }

  const entry = getFont(family);
  if (!entry) return;

  const quads = layoutGlyphs(
    cmd.text,
    { fontSize: style.fontSize, align: style.align, baseline: 'alphabetic' },
    entry.font,
    { x: cmd.x, y: cmd.y },
  );
  if (quads.length === 0) return;

  const vertices = quadsToVertexBuffer(quads);
  const indices = buildQuadIndexBuffer(quads.length);

  const gl = ctx.gl;
  gl.useProgram(ctx.textSdf.handle);

  // Step 3: dynamic per-draw VBO/VAO. TODO(step 7): reusable buffer pool.
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('drawText: createVertexArray returned null');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('drawText: createBuffer (VBO) returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

  const stride = 16;
  const aPosLoc = ctx.textSdf.attribute('a_position');
  const aUvLoc  = ctx.textSdf.attribute('a_uv');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('drawText: createBuffer (IBO) returned null');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

  setProjAndModel(ctx, ctx.textSdf);

  let r = 0, g = 0, b = 0, a = 1;
  if (style.fill && 'color' in style.fill) {
    [r, g, b, a] = parseColor(style.fill.color);
  }
  gl.uniform4f(ctx.textSdf.uniform('u_color')!, r, g, b, a);
  gl.uniform1f(ctx.textSdf.uniform('u_alpha')!, ctx.state.alpha);
  gl.uniform1f(ctx.textSdf.uniform('u_aaWidth')!, 0.05);

  ctx.textureCache.bind(family, 0);
  gl.uniform1i(ctx.textSdf.uniform('u_atlas')!, 0);

  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

export { mat3, getMesh };
