import type { Stroke, Paint } from '@orochi235/weasel';
import { resolveTextStyle } from '@orochi235/weasel';
import type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
} from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache, GLMeshHandle } from './GLMeshCache';
import type { GLTextureCache } from './GLTextureCache';
import type { GLImageCache, PatternRepetition } from './GLImageCache';
import type { GradientRampCache } from './GradientRampCache';
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
  imageFill: ShaderProgram;
  gradFill: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRampCache: GradientRampCache;
  state: GroupState;
  widthCss: number;
  heightCss: number;
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group': return drawGroup(ctx, cmd);
    case 'path':  return drawPath(ctx, cmd);
    case 'text':  return drawText(ctx, cmd);
    case 'image': return drawImage(ctx, cmd);
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
      drawPathFillByKind(ctx, cmd.fill, handle);
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

function drawPathFillByKind(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  const kind = fill.fill ?? 'solid';
  if (kind === 'solid') {
    const solid = fill as { color: string; opacity?: number };
    drawPathFillSolid(ctx, solid, handle);
  } else if (kind === 'pattern') {
    drawPathFillPattern(ctx, fill as Extract<Paint, { fill: 'pattern' }>, handle);
  } else {
    drawPathFillGradient(ctx, fill as Extract<Paint, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>, handle);
  }
}

function drawPathFillSolid(
  ctx: DrawContext,
  fill: { color: string; opacity?: number },
  handle: GLMeshHandle,
): void {
  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, fill.color, fill.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathFillPattern(
  ctx: DrawContext,
  fill: Extract<Paint, { fill: 'pattern' }>,
  handle: GLMeshHandle,
): void {
  // CanvasPattern's image / repetition are non-standard but present in major browsers.
  const patternAny = fill.pattern as unknown as {
    image?: ImageBitmap | HTMLImageElement | HTMLCanvasElement;
    repetition?: PatternRepetition | string | null;
  };
  const image = patternAny.image;
  if (!image) {
    console.warn('weasel-gl: CanvasPattern has no .image; skipping pattern fill.');
    return;
  }
  const rep = (patternAny.repetition ?? 'repeat') as PatternRepetition;
  ctx.imageCache.upload(image, image, rep);

  // Pattern is rendered with the image-fill shader, with the path's fill mesh.
  // UV is derived from path-local coords / image dims; for v1 we use the
  // path-local position directly as the UV (a 1:1 mapping). This means the
  // pattern repeats every image-pixel-count units of path-local space.
  const gl = ctx.gl;
  gl.useProgram(ctx.imageFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.imageFill);
  ctx.imageCache.bind(image, 0);
  gl.uniform1i(ctx.imageFill.uniform('u_sampler')!, 0);
  gl.uniform1f(ctx.imageFill.uniform('u_opacity')!, fill.opacity ?? 1);
  gl.uniform1f(ctx.imageFill.uniform('u_alpha')!, ctx.state.alpha);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathFillGradient(
  ctx: DrawContext,
  fill: Extract<Paint, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>,
  handle: GLMeshHandle,
): void {
  const gl = ctx.gl;
  const key = ctx.gradRampCache.upload(fill.stops);

  gl.useProgram(ctx.gradFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.gradFill);

  // u_worldInv: identity for step 4 (gradients render in screen space).
  // Step 7 wires the actual view inverse through layers.
  const identity3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  gl.uniformMatrix3fv(ctx.gradFill.uniform('u_worldInv')!, false, identity3);

  ctx.gradRampCache.bind(key, 0);
  gl.uniform1i(ctx.gradFill.uniform('u_ramp')!, 0);
  gl.uniform1f(ctx.gradFill.uniform('u_alpha')!, ctx.state.alpha);
  gl.uniform1f(ctx.gradFill.uniform('u_opacity')!, fill.opacity ?? 1);

  if (fill.fill === 'linear-gradient') {
    gl.uniform1i(ctx.gradFill.uniform('u_gradKind')!, 0);
    const dx = fill.to.x - fill.from.x;
    const dy = fill.to.y - fill.from.y;
    const len = Math.hypot(dx, dy) || 1;
    gl.uniform2f(ctx.gradFill.uniform('u_gradP0')!, fill.from.x, fill.from.y);
    gl.uniform2f(ctx.gradFill.uniform('u_gradDir')!, dx / len, dy / len);
    gl.uniform1f(ctx.gradFill.uniform('u_gradLen')!, len);
    gl.uniform1f(ctx.gradFill.uniform('u_gradRadius')!, 0);
    gl.uniform1f(ctx.gradFill.uniform('u_gradAngle')!, 0);
  } else if (fill.fill === 'radial-gradient') {
    gl.uniform1i(ctx.gradFill.uniform('u_gradKind')!, 1);
    gl.uniform2f(ctx.gradFill.uniform('u_gradP0')!, fill.center.x, fill.center.y);
    gl.uniform2f(ctx.gradFill.uniform('u_gradDir')!, 0, 0);
    gl.uniform1f(ctx.gradFill.uniform('u_gradLen')!, 0);
    gl.uniform1f(ctx.gradFill.uniform('u_gradRadius')!, fill.radius);
    gl.uniform1f(ctx.gradFill.uniform('u_gradAngle')!, 0);
  } else {
    // conic
    gl.uniform1i(ctx.gradFill.uniform('u_gradKind')!, 2);
    gl.uniform2f(ctx.gradFill.uniform('u_gradP0')!, fill.center.x, fill.center.y);
    gl.uniform2f(ctx.gradFill.uniform('u_gradDir')!, 0, 0);
    gl.uniform1f(ctx.gradFill.uniform('u_gradLen')!, 0);
    gl.uniform1f(ctx.gradFill.uniform('u_gradRadius')!, 0);
    gl.uniform1f(ctx.gradFill.uniform('u_gradAngle')!, fill.angle);
  }

  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathFillStencil(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  // Step-4 evenodd stencil only supports solid fills cleanly. For non-solid,
  // fall back to a single-pass solid-equivalent (deferred refinement).
  if (fill.fill !== undefined && fill.fill !== 'solid') {
    console.warn('weasel-gl: evenodd stencil with non-solid fill not supported in step 4; rendering solid black.');
  }
  const solid = (fill.fill === undefined || fill.fill === 'solid')
    ? (fill as { color: string; opacity?: number })
    : { color: '#000', opacity: 1 };

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
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  if (paint.fill !== undefined && paint.fill !== 'solid') {
    throw new Error('weasel-gl step 2: stroke.paint must be solid; gradient/pattern arrives in step 5+');
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

function drawImage(ctx: DrawContext, cmd: ImageDrawCommand): void {
  ctx.imageCache.upload(cmd.image, cmd.image);

  const gl = ctx.gl;
  gl.useProgram(ctx.imageFill.handle);

  // Build a quad covering (x, y, w, h) with UV [0..1].
  const x0 = cmd.x, y0 = cmd.y;
  const x1 = cmd.x + cmd.w, y1 = cmd.y + cmd.h;
  const vertices = new Float32Array([
    x0, y0, 0, 0,
    x1, y0, 1, 0,
    x0, y1, 0, 1,
    x1, y1, 1, 1,
  ]);
  const indices = new Uint32Array([0, 1, 2, 1, 3, 2]);

  const vao = gl.createVertexArray();
  if (!vao) throw new Error('drawImage: createVertexArray returned null');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('drawImage: createBuffer returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

  const stride = 16;
  const aPosLoc = ctx.imageFill.attribute('a_position');
  const aUvLoc  = ctx.imageFill.attribute('a_uv');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('drawImage: createBuffer (IBO) returned null');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

  setProjAndModel(ctx, ctx.imageFill);
  ctx.imageCache.bind(cmd.image, 0);
  gl.uniform1i(ctx.imageFill.uniform('u_sampler')!, 0);
  gl.uniform1f(ctx.imageFill.uniform('u_opacity')!, cmd.opacity ?? 1);
  gl.uniform1f(ctx.imageFill.uniform('u_alpha')!, ctx.state.alpha);

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

export { mat3, getMesh };
