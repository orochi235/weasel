import type { Stroke, Paint, Path } from '@orochi235/weasel';
import { resolveTextStyle } from '@orochi235/weasel';
import type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  ShaderDrawCommand,
} from './DrawCommand';
import { getTexture, type TextureHandle } from './textures/registerTexture';
import type { ShaderUniform } from './shaders/registerProgram';
import type { GroupState } from './state/GroupState';
import type { GLMeshCache, GLMeshHandle } from './cache/GLMeshCache';
import type { GLTextureCache } from './cache/GLTextureCache';
import type { GLImageCache } from './cache/GLImageCache';
import type { GradientRampCache } from './cache/GradientRampCache';
import type { ShaderProgram } from './shaders/ShaderProgram';
import { mat3 } from './math/mat3';
import { getMesh } from './cache/cache';
import { parseColor } from './math/color';
import { tessellateStroke } from 'features/paths/tessellate/stroke';
import { resolveFontVariant, ensureFontTexture, textureCacheKey } from 'features/text/atlas/registerFont';
import { layoutGlyphs, quadsToVertexBuffer, buildQuadIndexBuffer } from 'features/text/atlas/GlyphLayout';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  pathFillVColor: ShaderProgram;
  textSdf: ShaderProgram;
  imageFill: ShaderProgram;
  gradFill: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRampCache: GradientRampCache;
  programRegistry: Map<string, ShaderProgram>;
  quadVbo: WebGLBuffer | null;
  quadIbo: WebGLBuffer | null;
  /** Shared rect-fill geometry (see WeaselRenderer.uploadRectGeometry). */
  rectVao: WebGLVertexArrayObject | null;
  rectVbo: WebGLBuffer | null;
  state: GroupState;
  widthCss: number;
  heightCss: number;
  /**
   * Current clip nesting depth. Tracked as a flat scalar on DrawContext (not
   * part of GroupState's per-frame stack) because it must survive pop() during
   * drawGroup teardown — we decrement it manually after popClip. Starts at 0;
   * incremented/decremented symmetrically by drawGroup around cmd.clip pushes.
   */
  clipDepth: number;
}

/**
 * Upload the cumulative color matrix from GroupState to a shader's
 * `u_colorMatrix` (mat4) and `u_colorBias` (vec4) uniforms. Splits the 4×5
 * row-major form into a column-major mat4 + vec4 bias. Used by every shader
 * that accepts the group color matrix: pathFill, pathFillVColor, textSdf,
 * imageFill.
 */
function setColorMatrixUniforms(ctx: DrawContext, prog: ShaderProgram): void {
  const gl = ctx.gl;
  const cm = ctx.state.colorMatrix; // row-major 4×5
  const m4 = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      m4[col * 4 + row] = cm[row * 5 + col];
    }
  }
  const mLoc = prog.uniform('u_colorMatrix');
  const bLoc = prog.uniform('u_colorBias');
  if (mLoc !== undefined) gl.uniformMatrix4fv(mLoc, false, m4);
  if (bLoc !== undefined) gl.uniform4f(bLoc, cm[4], cm[9], cm[14], cm[19]);
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group':  return drawGroup(ctx, cmd);
    case 'path':   return drawPath(ctx, cmd);
    case 'text':   return drawText(ctx, cmd);
    case 'image':  return drawImage(ctx, cmd);
    case 'shader': return drawShader(ctx, cmd);
  }
}

const warnedUniforms = new Set<string>();
function warnOnceUniform(programId: string, name: string): void {
  const key = `${programId}:${name}`;
  if (warnedUniforms.has(key)) return;
  warnedUniforms.add(key);
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
  if (isDev) {
    console.warn(`weasel drawShader: uniform "${name}" not found in program "${programId}". ` +
      `Check spelling, ensure it's used in the shader (unused uniforms are optimized away by the driver).`);
  }
}

/**
 * Bind a single ShaderUniform value to a GL uniform location.
 *
 * Type detection order:
 *   1. TextureHandle (object with string `.id`) — bind to next tex unit, set sampler.
 *   2. Float32Array — length 9 → mat3, length 16 → mat4. Other lengths throw in dev.
 *   3. Array — uniform2fv / uniform3fv / uniform4fv based on length.
 *   4. number — uniform1f.
 */
function setUniform(
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation,
  value: ShaderUniform,
  textureCache: GLTextureCache,
  nextTexUnit: { value: number },
): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Float32Array)
      && 'id' in value && typeof (value as TextureHandle).id === 'string') {
    const handle = value as TextureHandle;
    const entry = getTexture(handle.id);
    if (!entry) {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      if (isDev) console.warn(`weasel setUniform: TextureHandle "${handle.id}" not registered`);
      return;
    }
    const unit = nextTexUnit.value++;
    textureCache.upload(handle.id, entry.source);
    textureCache.bind(handle.id, unit);
    gl.uniform1i(loc, unit);
    return;
  }

  if (value instanceof Float32Array) {
    if (value.length === 9) {
      gl.uniformMatrix3fv(loc, false, value);
    } else if (value.length === 16) {
      gl.uniformMatrix4fv(loc, false, value);
    } else {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      if (isDev) throw new TypeError(`weasel setUniform: Float32Array must be length 9 (mat3) or 16 (mat4), got ${value.length}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    const arr = value as readonly number[];
    switch (arr.length) {
      case 2: gl.uniform2fv(loc, arr as [number, number]); break;
      case 3: gl.uniform3fv(loc, arr as [number, number, number]); break;
      case 4: gl.uniform4fv(loc, arr as [number, number, number, number]); break;
      default: {
        const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
        if (isDev) throw new TypeError(`weasel setUniform: array length ${arr.length} not supported`);
      }
    }
    return;
  }

  if (typeof value === 'number') {
    gl.uniform1f(loc, value);
    return;
  }
}

function drawShader(ctx: DrawContext, cmd: ShaderDrawCommand): void {
  const { gl, programRegistry, quadVbo, quadIbo, textureCache } = ctx;

  const program = programRegistry.get(cmd.program.id);
  if (!program) {
    console.warn(
      `weasel drawShader: program "${cmd.program.id}" not compiled on this renderer. ` +
      `Call renderer.registerProgram(handle) after the module-level registerProgram().`,
    );
    return;
  }
  if (!quadVbo || !quadIbo) {
    console.warn('weasel drawShader: quad geometry not initialized');
    return;
  }

  gl.useProgram(program.handle);

  const aPosLoc = program.attribute('a_position');
  const aUvLoc  = program.attribute('a_uv');

  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 16, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, 16, 8);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIbo);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  const uProj = program.uniform('u_proj');
  if (uProj !== undefined) gl.uniformMatrix3fv(uProj, false, proj);

  const uBounds = program.uniform('u_bounds');
  if (uBounds !== undefined) {
    gl.uniform4f(uBounds, cmd.bounds.x, cmd.bounds.y, cmd.bounds.w, cmd.bounds.h);
  }

  const uView = program.uniform('u_view');
  if (uView !== undefined) gl.uniformMatrix3fv(uView, false, ctx.state.transform);

  const nextTexUnit = { value: 1 };
  for (const [name, value] of Object.entries(cmd.uniforms)) {
    const loc = program.uniform(name);
    if (loc === undefined) {
      warnOnceUniform(cmd.program.id, name);
      continue;
    }
    setUniform(gl, loc, value, textureCache, nextTexUnit);
  }

  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  if (aPosLoc !== undefined) gl.disableVertexAttribArray(aPosLoc);
  if (aUvLoc  !== undefined) gl.disableVertexAttribArray(aUvLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

export function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  ctx.state.push({
    transform: cmd.transform,
    alpha: cmd.alpha,
    colorMatrix: cmd.colorMatrix,
  });
  if (cmd.clip) {
    const newDepth = ctx.clipDepth + 1;
    if (newDepth > 7) {
      ctx.state.pop();
      throw new Error(
        'weasel: clip nesting depth exceeded (max 7). You can\'t nest more than 7 levels ' +
        'of clipped containers in a single draw tree. Flatten the hierarchy or compose ' +
        'poses outside the scene graph.',
      );
    }
    pushClip(ctx, cmd.clip, newDepth);
    ctx.clipDepth = newDepth;
  }
  for (const child of cmd.children) dispatch(ctx, child);
  if (cmd.clip) {
    popClip(ctx, cmd.clip, ctx.clipDepth - 1);
    ctx.clipDepth -= 1;
  }
  ctx.state.pop();
}

function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill && !cmd.stroke) return;

  if (cmd.fill) {
    // Fast path: solid-fill rect with no vertex colors → shared rect VAO,
    // bufferSubData the 4 corners, no per-rect mesh cache entry. Avoids the
    // GL-buffer-leak-per-frame in animated demos creating fresh Path objects
    // every render.
    const isSolidRectFast =
      cmd.path.kind === 'rect'
      && (cmd.fill.fill === undefined || cmd.fill.fill === 'solid')
      && (!cmd.vertexColors || cmd.vertexColors.length === 0)
      && ctx.rectVao !== null
      && ctx.rectVbo !== null;
    if (isSolidRectFast && cmd.path.kind === 'rect') {
      drawRectFast(ctx, cmd.path, cmd.fill as { color: string; opacity?: number });
    } else {
      const mesh = getMesh(cmd.path);
      const handle = ctx.meshCache.handleFor(mesh);
      if (cmd.vertexColors && cmd.vertexColors.length > 0 &&
          (cmd.fill.fill === undefined || cmd.fill.fill === 'solid')) {
        drawPathFillVColor(ctx, cmd, cmd.fill as { color: string; opacity?: number }, handle);
      } else if (handle.requiresStencil) {
        drawPathFillStencil(ctx, cmd.fill, handle);
      } else {
        drawPathFillByKind(ctx, cmd.fill, handle);
      }
    }
  }

  if (cmd.stroke) {
    drawPathStroke(ctx, cmd);
  }
}

/**
 * Fast path for solid-fill rects: reuses one VAO/VBO/IBO across all rect
 * renders, just bufferSubData's the 4 corner coords. Saves the
 * createBuffer/createVertexArray/bufferData round trip per rect.
 */
function drawRectFast(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  fill: { color: string; opacity?: number },
): void {
  const gl = ctx.gl;
  const { x, y, width: w, height: h } = rect;
  const corners = new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]);
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(ctx.rectVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, ctx.rectVbo);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, corners);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, ctx.pathFill);
  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function expandAnchorColors(perAnchor: number[], handle: GLMeshHandle): Float32Array {
  const aA = handle.anchorA;
  const aB = handle.anchorB;
  const aT = handle.anchorT;
  if (!aA || !aB || !aT) {
    // Legacy fallback: mesh lacks anchor params (e.g. non-path mesh). Treat
    // the caller-provided array as already per-vertex.
    return new Float32Array(perAnchor);
  }
  const n = aA.length;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a4 = aA[i] * 4;
    const b4 = aB[i] * 4;
    const t = aT[i];
    out[i * 4 + 0] = perAnchor[a4 + 0] + (perAnchor[b4 + 0] - perAnchor[a4 + 0]) * t;
    out[i * 4 + 1] = perAnchor[a4 + 1] + (perAnchor[b4 + 1] - perAnchor[a4 + 1]) * t;
    out[i * 4 + 2] = perAnchor[a4 + 2] + (perAnchor[b4 + 2] - perAnchor[a4 + 2]) * t;
    out[i * 4 + 3] = perAnchor[a4 + 3] + (perAnchor[b4 + 3] - perAnchor[a4 + 3]) * t;
  }
  return out;
}

function drawPathFillVColor(
  ctx: DrawContext,
  cmd: PathDrawCommand,
  fill: { color: string; opacity?: number },
  handle: GLMeshHandle,
): void {
  const gl = ctx.gl;
  const prog = ctx.pathFillVColor;
  gl.useProgram(prog.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);

  const expanded = expandAnchorColors(cmd.vertexColors!, handle);
  const colorVbo = gl.createBuffer();
  if (!colorVbo) throw new Error('drawPathFillVColor: createBuffer (color VBO) returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
  gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
  const aVColorLoc = prog.attribute('a_vertexColor');
  if (aVColorLoc !== undefined) {
    gl.enableVertexAttribArray(aVColorLoc);
    gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
  }

  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  // The per-vertex color VBO is freshly allocated per draw; free it now
  // (after unbinding the VAO) so we don't leak one buffer per vColor draw.
  gl.deleteBuffer(colorVbo);
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
  setColorMatrixUniforms(ctx, ctx.pathFill);
  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathFillPattern(
  ctx: DrawContext,
  fill: Extract<Paint, { fill: 'pattern' }>,
  handle: GLMeshHandle,
): void {
  const tex = fill.pattern as TextureHandle;
  const entry = getTexture(tex.id);
  if (!entry) {
    const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
    if (isDev) console.warn(`weasel: pattern TextureHandle "${tex.id}" not registered`);
    return;
  }
  ctx.textureCache.upload(tex.id, entry.source);

  // Pattern is rendered with the image-fill shader, with the path's fill mesh.
  // UV is derived from path-local coords; for v1 we use the path-local
  // position directly as the UV (1:1). The pattern repeats every
  // image-pixel-count units of path-local space, matching the prior behavior.
  const gl = ctx.gl;
  gl.useProgram(ctx.imageFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.imageFill);
  setColorMatrixUniforms(ctx, ctx.imageFill);
  ctx.textureCache.bind(tex.id, 0);
  gl.uniform1i(ctx.imageFill.uniform('u_sampler')!, 0);
  gl.uniform1f(ctx.imageFill.uniform('u_opacity')!, fill.opacity ?? 1);
  gl.uniform1f(ctx.imageFill.uniform('u_alpha')!, ctx.state.alpha);
  applyClipTest(ctx);
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

  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

// ─── Per-fragment clip test ───────────────────────────────────────────────────

/**
 * Set the stencil test for the current clip depth. Called by every
 * fragment-producing draw before its drawElements call when clipDepth > 0.
 * At clipDepth = 0, disables STENCIL_TEST (zero-overhead common case).
 *
 * Note: not called by drawPathFillStencil / drawPathStrokeStenciled, which
 * manage their own stencil state (evenodd / inner-outer stencil). Those paths
 * coexist with clip bits because they use bit 0 exclusively while clip levels
 * occupy bits 1-7.
 */
function applyClipTest(ctx: DrawContext): void {
  const gl = ctx.gl;
  const depth = ctx.clipDepth;
  if (depth === 0) {
    gl.disable(gl.STENCIL_TEST);
    return;
  }
  const mask = ancestorMask(depth);
  gl.enable(gl.STENCIL_TEST);
  gl.stencilFunc(gl.EQUAL, mask, mask);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
}

// ─── Clip-stencil helpers ────────────────────────────────────────────────────

/**
 * Bit-mask for ancestor clip levels.
 * Returns bits 1..depth (inclusive).
 * depth=0 → 0x00; depth=1 → 0x02; depth=3 → 0x0E.
 */
function ancestorMask(depth: number): number {
  return depth === 0 ? 0 : ((1 << (depth + 1)) - 1) & 0xFE;
}

/**
 * Rasterize a path into the stencil buffer using the pathFill shader geometry.
 * The caller is responsible for setting stencilFunc / stencilOp / stencilMask
 * and colorMask before calling.
 */
function rasterizePathToStencil(ctx: DrawContext, path: Path): void {
  const gl = ctx.gl;
  const mesh = getMesh(path);
  const handle = ctx.meshCache.handleFor(mesh);
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

/**
 * Push a clip level. Rasterizes the clip path into the stencil buffer,
 * setting bit `newDepth` where (a) the path's fragment passes AND (b) all
 * ancestor clip bits are already set.
 */
export function pushClip(ctx: DrawContext, path: Path, newDepth: number): void {
  const gl = ctx.gl;
  const ancestors = ancestorMask(newDepth - 1);
  const newBit = 1 << newDepth;
  const ref = ancestors | newBit;

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(newBit);
  gl.stencilFunc(gl.EQUAL, ref, ancestors);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

  rasterizePathToStencil(ctx, path);

  gl.colorMask(true, true, true, true);
}

/**
 * Pop a clip level. Rasterizes the same path again, clearing bit
 * `oldDepth + 1` where it was set during the matching push.
 */
export function popClip(ctx: DrawContext, path: Path, oldDepth: number): void {
  const gl = ctx.gl;
  const oldBit = 1 << (oldDepth + 1);
  const ref = ancestorMask(oldDepth) | oldBit;

  gl.colorMask(false, false, false, false);
  gl.stencilMask(oldBit);
  gl.stencilFunc(gl.EQUAL, ref, ref);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);

  rasterizePathToStencil(ctx, path);

  gl.colorMask(true, true, true, true);
}

// ─────────────────────────────────────────────────────────────────────────────

function drawPathFillStencil(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  // Step-4 evenodd stencil only supports solid fills cleanly. For non-solid,
  // fall back to a single-pass solid-equivalent (deferred refinement).
  if (fill.fill !== undefined && fill.fill !== 'solid') {
    console.warn('weasel: evenodd stencil with non-solid fill not supported in step 4; rendering solid black.');
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
  gl.stencilMask(0x01);
  gl.stencilFunc(gl.ALWAYS, 0, 0x01);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  const clipMask = ancestorMask(ctx.clipDepth);
  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.EQUAL, clipMask | 0x01, clipMask | 0x01);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, ctx.pathFill);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  if (paint.fill !== undefined && paint.fill !== 'solid') {
    throw new Error('weasel step 2: stroke.paint must be solid; gradient/pattern arrives in step 5+');
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
  // tessellateStroke returns a freshly-built Mesh every frame; route through
  // the transient pool so the renderer frees these at end-of-frame.
  const handle = ctx.meshCache.uploadTransient(mesh);

  const gl = ctx.gl;
  if (stroke.vertexColors && stroke.vertexColors.length > 0) {
    const prog = ctx.pathFillVColor;
    gl.useProgram(prog.handle);
    gl.bindVertexArray(handle.vao);
    setProjAndModel(ctx, prog);
    setSolidPaintUniforms(ctx, prog, solid.color, solid.opacity);
    setColorMatrixUniforms(ctx, prog);

    const expanded = expandAnchorColors(stroke.vertexColors, handle);
    const colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathStrokeUnclipped: createBuffer (color VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
    gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
    const aVColorLoc = prog.attribute('a_vertexColor');
    if (aVColorLoc !== undefined) {
      gl.enableVertexAttribArray(aVColorLoc);
      gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
    }
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    // Per-draw color VBO; free after VAO unbind to avoid leak per stroke vColor draw.
    gl.deleteBuffer(colorVbo);
    return;
  }

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, ctx.pathFill);
  applyClipTest(ctx);
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

  // getMesh memoizes by Path identity, so fillMesh is safe to cache normally.
  const fillMesh = getMesh(cmd.path);
  const fillHandle = ctx.meshCache.handleFor(fillMesh);
  const ribbonMesh = tessellateStroke(cmd.path, widerStroke);
  if (ribbonMesh.indices.length === 0) return;
  // The ribbon mesh is freshly tessellated each frame; transient.
  const ribbonHandle = ctx.meshCache.uploadTransient(ribbonMesh);

  const gl = ctx.gl;
  const useVColor = !!(stroke.vertexColors && stroke.vertexColors.length > 0);
  const prog = useVColor ? ctx.pathFillVColor : ctx.pathFill;
  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0x01);
  gl.stencilFunc(gl.ALWAYS, 1, 0x01);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.bindVertexArray(fillHandle.vao);
  gl.drawElements(gl.TRIANGLES, fillHandle.indexCount, gl.UNSIGNED_INT, 0);

  const clipMask = ancestorMask(ctx.clipDepth);
  gl.colorMask(true, true, true, true);
  if (align === 'inner') {
    gl.stencilFunc(gl.EQUAL, clipMask | 0x01, clipMask | 0x01);
  } else {
    gl.stencilFunc(gl.EQUAL, clipMask, clipMask | 0x01);
  }
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  setSolidPaintUniforms(ctx, prog, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, prog);
  gl.bindVertexArray(ribbonHandle.vao);

  let colorVbo: WebGLBuffer | null = null;
  if (useVColor) {
    const expanded = expandAnchorColors(stroke.vertexColors!, ribbonHandle);
    colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathStrokeStenciled: createBuffer (color VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
    gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
    const aVColorLoc = prog.attribute('a_vertexColor');
    if (aVColorLoc !== undefined) {
      gl.enableVertexAttribArray(aVColorLoc);
      gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
    }
  }

  gl.drawElements(gl.TRIANGLES, ribbonHandle.indexCount, gl.UNSIGNED_INT, 0);
  if (colorVbo) gl.deleteBuffer(colorVbo);

  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

function normalizeFontWeight(w: number | string | undefined): number {
  if (w === undefined) return 400;
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const parsed = Number(w);
  return Number.isFinite(parsed) ? parsed : 400;
}

function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const family = style.fontFamily;
  const weight = normalizeFontWeight(style.fontWeight);
  const fontStyle = style.fontStyle;

  const resolved = resolveFontVariant(family, weight, fontStyle);
  if (!resolved.entry) {
    console.warn(
      `weasel drawText: no atlas registered for "${family}" ${weight}/${fontStyle}; call registerFont() first.`,
    );
    return;
  }

  // Cache key targets the *resolved* variant, which may differ from the
  // requested (family, weight, style) when fallback kicked in. Slice 2
  // will wire the synthetic flags into shader uniforms so the resolved
  // atlas can paint with bold-thicken / italic-skew compensation.
  const cacheW = resolved.resolved.weight;
  const cacheS = resolved.resolved.style;
  if (!ensureFontTexture(family, cacheW, cacheS, ctx.textureCache)) return;

  const entry = resolved.entry;

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
  setColorMatrixUniforms(ctx, ctx.textSdf);

  let r = 0, g = 0, b = 0, a = 1;
  if (style.fill && 'color' in style.fill) {
    [r, g, b, a] = parseColor(style.fill.color);
  }
  gl.uniform4f(ctx.textSdf.uniform('u_color')!, r, g, b, a);
  gl.uniform1f(ctx.textSdf.uniform('u_alpha')!, ctx.state.alpha);
  gl.uniform1f(ctx.textSdf.uniform('u_aaWidth')!, 0.05);

  ctx.textureCache.bind(textureCacheKey(family, cacheW, cacheS), 0);
  gl.uniform1i(ctx.textSdf.uniform('u_atlas')!, 0);

  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  // Each text draw allocates a fresh VAO/VBO/IBO; free them now so animated
  // text demos don't leak one set per frame.
  gl.deleteVertexArray(vao);
  gl.deleteBuffer(vbo);
  gl.deleteBuffer(ibo);
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
  setColorMatrixUniforms(ctx, ctx.imageFill);
  ctx.imageCache.bind(cmd.image, 0);
  gl.uniform1i(ctx.imageFill.uniform('u_sampler')!, 0);
  gl.uniform1f(ctx.imageFill.uniform('u_opacity')!, cmd.opacity ?? 1);
  gl.uniform1f(ctx.imageFill.uniform('u_alpha')!, ctx.state.alpha);

  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  // Same deal as drawText: free the per-draw VAO/VBO/IBO immediately to
  // avoid leaking one set per image render.
  gl.deleteVertexArray(vao);
  gl.deleteBuffer(vbo);
  gl.deleteBuffer(ibo);
}

export { mat3, getMesh };
