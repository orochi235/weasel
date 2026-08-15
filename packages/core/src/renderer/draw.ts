import type { Stroke, FillStyle, GradientUnits, Path } from '@weasel-js/core';
import { resolveTextStyle } from '@weasel-js/core';
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
import { IDENTITY_COLOR_MATRIX, type GroupState } from './state/GroupState';
import type { GLMeshCache, GLMeshHandle } from './cache/GLMeshCache';
import type { GLTextureCache } from './cache/GLTextureCache';
import type { GLImageCache } from './cache/GLImageCache';
import type { GradientRampCache } from './cache/GradientRampCache';
import type { ShaderProgram } from './shaders/ShaderProgram';
import { mat3, type Mat3 } from './math/mat3';
import { getMesh } from './cache/cache';
import { tessellate } from 'features/paths/tessellate/tessellate';
import { resolveColor } from './math/color';
import { tessellateStroke } from 'features/paths/tessellate/stroke';
import {
  ensureFontTexture,
  textureCacheKey,
  syncDynamicPageTexture,
  dynamicPageTextureId,
} from '@weasel-js/font';
import {
  type LaidOutGroup, type LaidOutDecoration, type LaidOutOutlineGlyph,
} from 'features/text/atlas/layoutRuns';
import { cachedLayoutRuns } from './cache/layoutCache';
import { verticalAlignOffset } from 'features/text/verticalAlign';
import type { Mesh } from './cache/mesh';
import { outlineMesh } from './cache/outlineMeshCache';
import { outlineStrokeMesh, quantizeEmWidth } from './cache/outlineStrokeMeshCache';
import { RectBatch, MAX_RECTS_PER_BATCH } from './rectBatch';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  pathFillVColor: ShaderProgram;
  textSdf: ShaderProgram;
  textSdfR8: ShaderProgram;
  imageFill: ShaderProgram;
  gradFill: ShaderProgram;
  patternFill: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRampCache: GradientRampCache;
  programRegistry: Map<string, ShaderProgram>;
  quadVbo: WebGLBuffer | null;
  quadIbo: WebGLBuffer | null;
  /** Staging for the consecutive-rect batch. Draws are deferred into it, so a
   *  caller driving `dispatch` itself must `flushRects` when the stream ends. */
  rectBatch: RectBatch;
  /** Group state the staged rects were built under; `undefined` while nothing
   *  is staged. Written only by `pushRect` / `flushRects`. */
  rectState?: StagedRectState;
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
  /** Flatness tolerance for curve tessellation, in WORLD units. When set,
   *  fill meshes bypass the Path-identity cache (whose key excludes
   *  tolerance) and are tessellated fresh per frame via the transient pool.
   *  See `WeaselRendererOptions.flattenTolerance`. */
  flattenTolerance?: number;
  /** On-screen glyph size (CSS px) at which text switches to tessellated
   *  outlines. See `WeaselRendererOptions.textOutlineMinScreenSize`. */
  textOutlineMinScreenSize?: number;
  /** World→screen transform for the frame, when the caller supplied one.
   *  Only `units: 'world'` gradients read it; absent, they fall back to
   *  screen space. See `WeaselRenderer.render`. */
  viewMatrix?: Mat3;
}

/**
 * Upload the cumulative color matrix from GroupState to a shader's
 * `u_colorMatrix` (mat4) and `u_colorBias` (vec4) uniforms. Splits the 4×5
 * row-major form into a column-major mat4 + vec4 bias. Used by every shader
 * that accepts the group color matrix: pathFill, pathFillVColor, textSdf,
 * imageFill.
 */
/**
 * Uniform values a program already holds this frame.
 *
 * GL keeps uniform state per program object, so re-sending a value the program
 * already has buys nothing. `u_proj` is constant for the whole frame and
 * `u_colorMatrix` is the identity in every scene that does not use one, yet
 * both were re-sent for every command: at a few thousand commands the two were
 * most of the frame.
 *
 * Keyed on the `DrawContext`, which `WeaselRenderer.render` builds fresh per
 * frame, so the cache cannot outlive a frame and go stale against GL state
 * that changed between them.
 *
 * **Only for uniforms this module is the sole writer of.** `u_color` and
 * `u_alpha` are written from several places here and are still sent every
 * draw; caching those would need every writer to go through this first.
 */
interface UploadedUniforms {
  proj?: Float32Array;
  model?: Float32Array;
  colorMatrix?: Float32Array;
  colorBias?: Float32Array;
}

const FRAME_UPLOADS = new WeakMap<DrawContext, WeakMap<ShaderProgram, UploadedUniforms>>();
const FRAME_PROJ = new WeakMap<DrawContext, Mat3>();

function uploadedFor(ctx: DrawContext, prog: ShaderProgram): UploadedUniforms {
  let byProgram = FRAME_UPLOADS.get(ctx);
  if (!byProgram) {
    byProgram = new WeakMap();
    FRAME_UPLOADS.set(ctx, byProgram);
  }
  let uploaded = byProgram.get(prog);
  if (!uploaded) {
    uploaded = {};
    byProgram.set(prog, uploaded);
  }
  return uploaded;
}

/** Element-wise, so a caller that mutates a shared array in place is still
 *  compared by value. A NaN anywhere compares unequal and re-uploads, which is
 *  the safe direction. */
function sameValues(prev: Float32Array | undefined, next: ArrayLike<number>): boolean {
  if (prev === undefined || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) if (prev[i] !== next[i]) return false;
  return true;
}

/** The rect batch transforms its own corners, so it draws at model identity. */
const BATCH_MODEL = mat3.identity();

/** The screen→clip matrix depends only on the frame's dimensions. */
function projFor(ctx: DrawContext): Mat3 {
  let proj = FRAME_PROJ.get(ctx);
  if (!proj) {
    proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
    FRAME_PROJ.set(ctx, proj);
  }
  return proj;
}

/** Reused across draws: the transpose below rebuilt this every command. */
const COLOR_MATRIX_SCRATCH = new Float32Array(16);

function setColorMatrixUniforms(
  ctx: DrawContext, prog: ShaderProgram,
  cm: Float32Array = ctx.state.colorMatrix, // row-major 4×5
): void {
  const gl = ctx.gl;
  const uploaded = uploadedFor(ctx, prog);

  const mLoc = prog.uniform('u_colorMatrix');
  if (mLoc !== undefined) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        COLOR_MATRIX_SCRATCH[col * 4 + row] = cm[row * 5 + col];
      }
    }
    if (!sameValues(uploaded.colorMatrix, COLOR_MATRIX_SCRATCH)) {
      gl.uniformMatrix4fv(mLoc, false, COLOR_MATRIX_SCRATCH);
      uploaded.colorMatrix = Float32Array.from(COLOR_MATRIX_SCRATCH);
    }
  }

  const bLoc = prog.uniform('u_colorBias');
  if (bLoc !== undefined) {
    const bias = [cm[4], cm[9], cm[14], cm[19]];
    if (!sameValues(uploaded.colorBias, bias)) {
      gl.uniform4f(bLoc, bias[0], bias[1], bias[2], bias[3]);
      uploaded.colorBias = Float32Array.from(bias);
    }
  }
}

/**
 * Resolve a fill mesh handle honoring ctx.flattenTolerance: default route is
 * the persistent Path-identity cache; a custom tolerance tessellates fresh
 * and rides the transient pool (freed at end of frame), because the
 * persistent cache's key does not include tolerance.
 */
function fillMeshHandle(ctx: DrawContext, path: Path): GLMeshHandle {
  if (ctx.flattenTolerance !== undefined) {
    return ctx.meshCache.uploadTransient(tessellate(path, { flattenTolerance: ctx.flattenTolerance }));
  }
  return ctx.meshCache.handleFor(getMesh(path));
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group':  return drawGroup(ctx, cmd);
    case 'path':   return drawPath(ctx, cmd);
    case 'text':   flushRects(ctx); return drawText(ctx, cmd);
    case 'image':  flushRects(ctx); return drawImage(ctx, cmd);
    case 'shader': flushRects(ctx); return drawShader(ctx, cmd);
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
    // Before, not after: `pushClip` rasterizes into the stencil, and a run
    // staged outside the clip would then draw under a mask it never had.
    flushRects(ctx);
    pushClip(ctx, cmd.clip, newDepth);
    ctx.clipDepth = newDepth;
  }
  for (const child of cmd.children) dispatch(ctx, child);
  if (cmd.clip) {
    // Likewise: past `popClip` the mask is gone, and these pixels belonged
    // inside it.
    flushRects(ctx);
    popClip(ctx, cmd.clip, ctx.clipDepth - 1);
    ctx.clipDepth -= 1;
  }
  ctx.state.pop();
}

function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill && !cmd.stroke) return;

  if (cmd.fill) {
    // Fast path: solid-fill rect with no vertex colors → append to the batch
    // instead of tessellating. Also keeps animated demos that mint a fresh
    // Path every frame from leaking a GL buffer per frame.
    const isSolidRect =
      cmd.path.kind === 'rect'
      && (cmd.fill.fill === undefined || cmd.fill.fill === 'solid')
      && (!cmd.vertexColors || cmd.vertexColors.length === 0);
    if (isSolidRect && cmd.path.kind === 'rect') {
      pushRect(ctx, cmd.path, cmd.fill as { color: string; opacity?: number });
    } else {
      flushRects(ctx);
      const handle = fillMeshHandle(ctx, cmd.path);
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
    flushRects(ctx);
    drawPathStroke(ctx, cmd);
  }
}

/**
 * The group state a staged run was built under.
 *
 * A run outlives the group it started in, so the state live when the flush
 * happens is not the state the rects belong to — the flush draws with these
 * values instead. Transform is absent because it rides the vertices; `alpha`
 * is 1 whenever it rode them too.
 */
interface StagedRectState {
  alpha: number;
  colorMatrix: Float32Array;
  clipDepth: number;
  /** Whether group alpha folded into the vertex colors. */
  foldsAlpha: boolean;
}

/** Identity in row-major 4×5 leaves `src` untouched *and* leaves the shader's
 *  clamp with nothing to do, which is what makes the alpha fold exact. */
function isIdentityColorMatrix(cm: Float32Array): boolean {
  return cm === IDENTITY_COLOR_MATRIX || sameValues(IDENTITY_COLOR_MATRIX, cm);
}

/**
 * Whether the live group state would draw the staged run identically.
 *
 * By value, not by reference: a group carrying an identity color matrix still
 * goes through `compose4x5`, which allocates a new array holding equal numbers.
 * Twenty float compares are nothing against the draw call they save.
 */
function stagedStateIsLive(ctx: DrawContext, staged: StagedRectState): boolean {
  if (staged.clipDepth !== ctx.clipDepth) return false;
  if (!staged.foldsAlpha && staged.alpha !== ctx.state.alpha) return false;
  const colorMatrix = ctx.state.colorMatrix;
  return staged.colorMatrix === colorMatrix || sameValues(staged.colorMatrix, colorMatrix);
}

/**
 * Stage a solid-fill rect for the batch, flushing first if the run is full or
 * if the live group state no longer matches what the run was staged under.
 * Fill opacity folds into the vertex alpha, exactly as `u_color` carried it
 * when each rect was its own draw.
 *
 * Group alpha folds in too, but only under an identity color matrix: the
 * shader is `a = clamp(CM * src + bias).a * u_alpha`, so with a real matrix
 * between them a pre-multiplied vertex alpha is a different number. There it
 * stays a uniform, and a differing alpha breaks the run as before.
 */
function pushRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  fill: { color: string; opacity?: number },
): void {
  if (ctx.rectState !== undefined && !stagedStateIsLive(ctx, ctx.rectState)) flushRects(ctx);
  if (ctx.rectBatch.length >= MAX_RECTS_PER_BATCH) flushRects(ctx);
  if (ctx.rectState === undefined) {
    const colorMatrix = ctx.state.colorMatrix;
    const foldsAlpha = isIdentityColorMatrix(colorMatrix);
    ctx.rectState = {
      alpha: foldsAlpha ? 1 : ctx.state.alpha,
      colorMatrix,
      clipDepth: ctx.clipDepth,
      foldsAlpha,
    };
  }
  const [r, g, b, a] = resolveColor(fill.color);
  const alpha = a * (fill.opacity ?? 1) * (ctx.rectState.foldsAlpha ? ctx.state.alpha : 1);
  ctx.rectBatch.push(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform,
    r, g, b, alpha,
  );
}

/**
 * Draw the staged run as one `drawElements`, under the state it was staged
 * under. Callers that are about to bind a different program, or paint anything
 * that must land on top of the run, call this first; a group that only changes
 * the color matrix does not, because `pushRect` notices and flushes then, and
 * one that only changes transform or alpha does not break the run at all.
 *
 * Clips are the exception both ways: the stencil is real GL state that the
 * staged values cannot reconstruct, so `drawGroup` flushes *before* mutating
 * it rather than leaving it to the next push.
 *
 * `u_color` stays white: the vertex-color program multiplies it by the
 * per-vertex color, so white makes the result bit-identical to the flat
 * program's `u_color`-only math. `u_model` stays identity for the same reason —
 * the corners arrive already transformed.
 */
export function flushRects(ctx: DrawContext): void {
  const batch = ctx.rectBatch;
  const staged = ctx.rectState;
  if (batch.length === 0 || staged === undefined) return;
  const gl = ctx.gl;
  const prog = ctx.pathFillVColor;
  gl.useProgram(prog.handle);
  const indexCount = batch.uploadAndBind();
  setProjAndModel(ctx, prog, BATCH_MODEL);
  gl.uniform4f(prog.uniform('u_color')!, 1, 1, 1, 1);
  gl.uniform1f(prog.uniform('u_alpha')!, staged.alpha);
  setColorMatrixUniforms(ctx, prog, staged.colorMatrix);
  applyClipTest(ctx, staged.clipDepth);
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  batch.reset();
  ctx.rectState = undefined;
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

function setProjAndModel(
  ctx: DrawContext, prog: ShaderProgram,
  model: Mat3 = ctx.state.transform,
): void {
  const gl = ctx.gl;
  const uploaded = uploadedFor(ctx, prog);

  const proj = projFor(ctx);
  if (!sameValues(uploaded.proj, proj)) {
    gl.uniformMatrix3fv(prog.uniform('u_proj')!, false, proj);
    uploaded.proj = Float32Array.from(proj);
  }

  if (!sameValues(uploaded.model, model)) {
    gl.uniformMatrix3fv(prog.uniform('u_model')!, false, model);
    uploaded.model = Float32Array.from(model);
  }
}

function setSolidPaintUniforms(
  ctx: DrawContext, prog: ShaderProgram,
  color: string, opacity: number | undefined,
): void {
  const gl = ctx.gl;
  const [r, g, b, a] = resolveColor(color);
  gl.uniform4f(prog.uniform('u_color')!, r, g, b, a * (opacity ?? 1));
  gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);
}

function drawPathFillByKind(ctx: DrawContext, fill: FillStyle, handle: GLMeshHandle): void {
  const kind = fill.fill ?? 'solid';
  if (kind === 'solid') {
    const solid = fill as { color: string; opacity?: number };
    drawPathFillSolid(ctx, solid, handle);
  } else if (kind === 'pattern') {
    drawPathFillPattern(ctx, fill as Extract<FillStyle, { fill: 'pattern' }>, handle);
  } else {
    drawPathFillGradient(ctx, fill as Extract<FillStyle, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>, handle);
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
  fill: Extract<FillStyle, { fill: 'pattern' }>,
  handle: GLMeshHandle,
): void {
  const tex = fill.pattern as TextureHandle;
  const entry = getTexture(tex.id);
  if (!entry) {
    const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
    if (isDev) console.warn(`weasel: pattern TextureHandle "${tex.id}" not registered`);
    return;
  }
  ctx.textureCache.upload(tex.id, entry.source, 'repeat');

  // A path fill mesh carries a_position only, so the tile coordinate is
  // recovered per fragment from the screen position — the same route
  // gradients take through `u_worldInv`, and the reason this can't reuse
  // the image-fill shader (whose a_uv would be unbound here, and was).
  const gl = ctx.gl;
  gl.useProgram(ctx.patternFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.patternFill);
  setColorMatrixUniforms(ctx, ctx.patternFill);
  gl.uniformMatrix3fv(ctx.patternFill.uniform('u_worldInv')!, false, gradientSpaceInverse(ctx, fill.units));
  const [tw, th] = textureSize(entry.source);
  const origin = fill.origin ?? { x: 0, y: 0 };
  gl.uniform2f(ctx.patternFill.uniform('u_tileOrigin')!, origin.x, origin.y);
  gl.uniform2f(ctx.patternFill.uniform('u_tileSize')!, tw, th);
  ctx.textureCache.bind(tex.id, 0);
  gl.uniform1i(ctx.patternFill.uniform('u_sampler')!, 0);
  gl.uniform1f(ctx.patternFill.uniform('u_opacity')!, fill.opacity ?? 1);
  gl.uniform1f(ctx.patternFill.uniform('u_alpha')!, ctx.state.alpha);
  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

/** Tile extent in paint-space units — one tile spans this many units of
 *  whatever space `units` names. */
function textureSize(source: HTMLImageElement | ImageBitmap): [number, number] {
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  return [w || 1, h || 1];
}

/**
 * Screen→gradient-space matrix for `u_worldInv`, which the vertex shader
 * applies to each fragment's screen position to recover the coordinates the
 * gradient's geometry is expressed in.
 *
 * `'world'` silently degrades to screen space when no view matrix reached
 * the renderer — `render(commands)` without a view is a supported call, and
 * a missing view is not worth a thrown frame.
 */
function gradientSpaceInverse(ctx: DrawContext, units: GradientUnits | undefined): Mat3 {
  if (units === 'local') return mat3.invert(ctx.state.transform);
  if (units === 'world' && ctx.viewMatrix) return mat3.invert(ctx.viewMatrix);
  return mat3.identity();
}

function drawPathFillGradient(
  ctx: DrawContext,
  fill: Extract<FillStyle, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>,
  handle: GLMeshHandle,
): void {
  const gl = ctx.gl;
  const key = ctx.gradRampCache.upload(fill.stops);

  gl.useProgram(ctx.gradFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.gradFill);

  gl.uniformMatrix3fv(ctx.gradFill.uniform('u_worldInv')!, false, gradientSpaceInverse(ctx, fill.units));

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
function applyClipTest(ctx: DrawContext, depth: number = ctx.clipDepth): void {
  const gl = ctx.gl;
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
  const handle = fillMeshHandle(ctx, path);
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
 *
 * Invariant: restores stencilMask(0xFF) on exit so callers (draw functions)
 * can rely on an unnarrowed mask after clip ops complete.
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
  // Restore full mask so subsequent draw functions don't inherit a narrowed mask.
  gl.stencilMask(0xFF);
}

/**
 * Pop a clip level. Rasterizes the same path again, clearing bit
 * `oldDepth + 1` where it was set during the matching push.
 *
 * Must re-enable STENCIL_TEST because child draw functions (drawPathFillStencil,
 * drawPathStrokeStenciled) call gl.disable(STENCIL_TEST) at their end. If
 * one of those was the last child before popClip runs, the test would be off
 * and rasterizePathToStencil would write nothing.
 *
 * Invariant: restores stencilMask(0xFF) on exit so callers are not left with
 * a narrowed mask.
 */
export function popClip(ctx: DrawContext, path: Path, oldDepth: number): void {
  const gl = ctx.gl;
  // Re-enable stencil: child draw functions (evenodd/stenciled-stroke) disable
  // it at their end; we must set it before writing the clear pass.
  gl.enable(gl.STENCIL_TEST);

  const oldBit = 1 << (oldDepth + 1);
  const ref = ancestorMask(oldDepth) | oldBit;

  gl.colorMask(false, false, false, false);
  gl.stencilMask(oldBit);
  gl.stencilFunc(gl.EQUAL, ref, ref);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);

  rasterizePathToStencil(ctx, path);

  gl.colorMask(true, true, true, true);
  // Restore full mask so subsequent draw functions don't inherit a narrowed mask.
  gl.stencilMask(0xFF);
}

// ─────────────────────────────────────────────────────────────────────────────

function drawPathFillStencil(ctx: DrawContext, fill: FillStyle, handle: GLMeshHandle): void {
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
  const mesh = tessellateStroke(cmd.path, stroke, { flattenTolerance: ctx.flattenTolerance });
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

  const fillHandle = fillMeshHandle(ctx, cmd.path);
  const ribbonMesh = tessellateStroke(cmd.path, widerStroke, { flattenTolerance: ctx.flattenTolerance });
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

/**
 * On-screen glyph size (CSS px) at or above which a face with registered
 * outlines is drawn as geometry instead of sampled from a distance field.
 *
 * 48 is the dynamic tier's own `BAKE_SIZE`, which makes it the size at which
 * that tier stops being an interpolation and starts being a magnification:
 * `glyphRasterizer.ts` measures coverage error bottoming out *at* the bake
 * size and rising on both sides, and past a few times it the reconstructed
 * field shows the raster as contour wobble. The same number is a safe
 * crossing for the baked MSDF atlas, which is still crisp here — outlines are
 * exact, so switching early costs nothing but the tessellation, and the
 * hinting the atlas has and outlines don't stopped mattering well below this.
 */
export const OUTLINE_MIN_SCREEN_PX = 48;

/**
 * Uniform scale the model matrix applies, as the geometric mean of its two
 * axis lengths. Used to turn a screen-pixel threshold into the world-space
 * size layout compares against.
 *
 * The mean rather than either axis alone so a non-uniform scale answers with
 * something between the two instead of picking a side; anisotropy that
 * extreme is not a case this threshold needs to be exact about, since being
 * one glyph-size late or early only changes which of two correct renderings
 * is used.
 */
function modelScale(m: Float32Array): number {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[3], m[4]);
  return Math.sqrt(sx * sy) || 1;
}

function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const lineHeight = style.lineHeight;
  const align = cmd.align ?? style.align;
  const maxWidth = cmd.maxWidth ?? Infinity;

  // Screen threshold → world threshold. Zooming in lowers the world size that
  // qualifies, which is the whole point: a 12px label at 8× zoom is 96 screen
  // pixels of text and wants outlines exactly as much as a 96px heading does.
  const minScreen = ctx.textOutlineMinScreenSize ?? OUTLINE_MIN_SCREEN_PX;
  const outlineMinSize = Number.isFinite(minScreen)
    ? minScreen / modelScale(ctx.state.transform)
    : undefined;

  const laid = cachedLayoutRuns(cmd.runs, { maxWidth, lineHeight, align, outlineMinSize });
  // Decorations are checked too: text whose glyphs are all ink-free — every
  // one still awaiting a dynamic-atlas bake, say — produces no groups at all
  // while still carrying a rule that has to be drawn.
  if (laid.groups.length === 0 && laid.decorations.length === 0) return;

  // `laid` is origin-relative, so this is the command's position plus the
  // verticalAlign shift. Applied at upload time, not baked in: the layout is
  // shared and not ours to edit — a cached layout that absorbed either offset
  // would gain another one every frame and slide off the page. Every consumer
  // below adds them while packing vertices, which costs one addition inside
  // loops that are already walking every vertex.
  const dx = cmd.x;
  const dy = cmd.y + verticalAlignOffset(cmd.verticalAlign, cmd.height, laid.bounds.height);

  const gl = ctx.gl;
  applyClipTest(ctx);
  const preparedPrograms = new Set<ShaderProgram>();
  let currentProg: ShaderProgram | null = null;
  for (const group of laid.groups) {
    if (group.source === 'outline') {
      drawTextOutlineGroup(ctx, group, dx, dy);
      // Outline groups go through the path-fill programs, which bind their
      // own. The next SDF group has to `useProgram` again; its uniforms
      // survive (they live on the program object), so `preparedPrograms`
      // stays as it is.
      currentProg = null;
      continue;
    }
    const prog = group.source === 'canvas' ? ctx.textSdfR8 : ctx.textSdf;
    if (prog !== currentProg) {
      gl.useProgram(prog.handle);
      currentProg = prog;
    }
    if (!preparedPrograms.has(prog)) {
      preparedPrograms.add(prog);
      setProjAndModel(ctx, prog);
      setColorMatrixUniforms(ctx, prog);
      gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);
      // No AA-width uniform: the text shaders derive their smoothstep band
      // from fwidth() per fragment. A CPU-side constant cannot be right at
      // more than one scale — see the textSdf.ts header.
    }
    drawTextGroup(ctx, group, prog, dx, dy);
  }

  drawTextDecorations(ctx, laid.decorations, dx, dy);
}

/**
 * Synthetic-oblique angle, in radians — 12°, the conventional CSS
 * `font-style: oblique`. Shared by the two tiers that fake an italic: the SDF
 * shader takes it as `u_synthItalic` and skews in the vertex stage, the
 * outline tier applies the same shear on the CPU while placing glyph
 * geometry. One constant so a face that falls back to the upright atlas leans
 * the same amount however it ends up being drawn.
 */
const SYNTHETIC_ITALIC_RADIANS = 0.2094;

/**
 * Paint one group of tessellated glyph outlines.
 *
 * The whole group becomes a single mesh: cached em-space triangles are
 * transformed on the CPU into world space and appended to one buffer, so a
 * paragraph set in one face and colour is one draw call — the same batching
 * the atlas tier gets from packing glyphs into one texture. The alternative,
 * a model matrix per glyph, would be a draw call per glyph.
 *
 * Going through `drawPathFillByKind` rather than straight to `pathFill` is
 * what makes gradient- and pattern-filled text fall out for free: a glyph
 * here is geometry like any other, and those programs shade in world space,
 * so they need nothing from the text pipeline.
 */
function drawTextOutlineGroup(ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number): void {
  const mesh = outlineGroupMesh(group, dx, dy);
  if (mesh) drawPathFillByKind(ctx, group.fill, ctx.meshCache.uploadTransient(mesh));

  // Stroke after fill — Canvas2D's fillText-then-strokeText convention, and
  // SVG's default paint-order. A second batched draw call over the same
  // group, not a call per glyph.
  if (!group.stroke) return;
  const strokeMesh = outlineGroupStrokeMesh(group, dx, dy);
  if (strokeMesh) {
    drawPathFillByKind(ctx, group.stroke.paint, ctx.meshCache.uploadTransient(strokeMesh));
  }
}

/**
 * Merge a group's glyphs into one world-space mesh, or `null` when nothing in
 * it has area.
 *
 * Every glyph mesh here is `'nonzero'` (that is what `pathFromD` produces and
 * what a font outline means), so none of them sets `requiresStencil` and
 * concatenating their triangles is sound — an even-odd mesh would be a naive
 * per-contour fan that only resolves correctly through a stencil pass, and
 * merging one into a batch would fill its counters solid.
 */
function outlineGroupMesh(group: LaidOutGroup, dx: number, dy: number): Mesh | null {
  return mergeGlyphMeshes(group, dx, dy, (glyph) => outlineMesh(glyph.key, glyph.d));
}

/**
 * The same merge for the group's stroke: one ribbon per glyph, tessellated in
 * em space and batched into one buffer, so a stroked paragraph is one extra
 * draw call rather than one per glyph.
 *
 * The width crosses into em space by dividing by the glyph's `scale`, which
 * is world units per em — so `stroke.width` stays a world-unit measure and
 * does not grow with `fontSize`, matching every other stroke in the kit.
 *
 * A synthetic oblique shears the ribbon along with the glyph. That is a real
 * (small) distortion — a sheared circle is an ellipse, so the outline is
 * marginally thicker across the lean than along it — and it is deliberate:
 * shearing the finished ribbon is what keeps the outline glued to the glyph
 * it outlines, which re-tessellating in sheared space would not.
 */
function outlineGroupStrokeMesh(group: LaidOutGroup, dx: number, dy: number): Mesh | null {
  const stroke = group.stroke;
  if (!stroke) return null;
  const width = stroke.width ?? 1;
  if (!(width > 0)) return null;
  return mergeGlyphMeshes(group, dx, dy, (glyph) =>
    glyph.scale > 0
      ? outlineStrokeMesh(glyph.key, glyph.d, quantizeEmWidth(width / glyph.scale), stroke)
      : null);
}

/**
 * Transform each glyph's em-space mesh into world space and concatenate.
 * Shared by the fill and stroke paths, which differ only in which mesh they
 * ask for per glyph — the placement math must not fork, or an outline would
 * drift off the glyph it outlines.
 */
function mergeGlyphMeshes(
  group: LaidOutGroup,
  dx: number,
  dy: number,
  meshFor: (glyph: LaidOutOutlineGlyph) => Mesh | null,
): Mesh | null {
  const parts: { mesh: Mesh; glyph: LaidOutOutlineGlyph }[] = [];
  let vertexFloats = 0;
  let indexCount = 0;
  for (const glyph of group.glyphs) {
    const mesh = meshFor(glyph);
    if (!mesh || mesh.indices.length === 0) continue;
    parts.push({ mesh, glyph });
    vertexFloats += mesh.vertices.length;
    indexCount += mesh.indices.length;
  }
  if (parts.length === 0) return null;

  // Matches the SDF vertex shader's skew exactly: x moves by
  // `(baselineY - y) * tan(angle)`, and in em space `baselineY - y` is
  // `-ey * scale`, so above-baseline vertices (negative ey) lean right.
  const shear = group.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;

  const vertices = new Float32Array(vertexFloats);
  const indices = new Uint32Array(indexCount);
  let vi = 0;
  let ii = 0;
  let base = 0;
  for (const { mesh, glyph } of parts) {
    const { x, baselineY, scale } = glyph;
    for (let k = 0; k < mesh.vertices.length; k += 2) {
      const ex = mesh.vertices[k];
      const ey = mesh.vertices[k + 1];
      vertices[vi++] = x + dx + (ex - ey * shear) * scale;
      vertices[vi++] = baselineY + dy + ey * scale;
    }
    for (let k = 0; k < mesh.indices.length; k++) indices[ii++] = base + mesh.indices[k];
    base += mesh.vertices.length / 2;
  }
  return { vertices, indices };
}

/**
 * Paint underline / strikethrough rules. These are untextured solid rects, so
 * they cannot ride in a `LaidOutGroup`'s quads — those upload a 5-float
 * stride with atlas UVs into an MSDF program. They go through `pathFill`
 * instead, batched by resolved colour so a whole decorated paragraph costs
 * one draw call per distinct rule colour.
 *
 * Drawn after the glyphs, so a rule sits on top of glyph ink where they
 * overlap (the CSS spec allows either order).
 */
function drawTextDecorations(ctx: DrawContext, decorations: readonly LaidOutDecoration[], dx: number, dy: number): void {
  if (decorations.length === 0) return;

  // Colour resolution matches drawTextGroup exactly — including its ignoring
  // of `fill.opacity` — so a rule can never disagree with the glyphs it
  // underlines.
  const batches = new Map<string, { rgba: readonly number[]; rects: LaidOutDecoration[] }>();
  for (const d of decorations) {
    const rgba = 'color' in d.fill ? resolveColor(d.fill.color) : [0, 0, 0, 1];
    const key = rgba.join(',');
    let batch = batches.get(key);
    if (!batch) { batch = { rgba, rects: [] }; batches.set(key, batch); }
    batch.rects.push(d);
  }

  const gl = ctx.gl;
  const prog = ctx.pathFill;
  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);
  setColorMatrixUniforms(ctx, prog);
  // Redundant in the current code — drawText applied this before the glyph
  // loop and nothing in between touches stencil state — but every other
  // pathFill entry point sets it here, and relying on a caller invariant this
  // signature doesn't express is worth less than one stencilFunc.
  applyClipTest(ctx);

  for (const { rgba, rects } of batches.values()) {
    // pathFill takes a_position only: stride 8, no UVs, no baselineY.
    const vertices = new Float32Array(rects.length * 4 * 2);
    let vi = 0;
    for (const d of rects) {
      const dx0 = d.x0 + dx, dx1 = d.x1 + dx;
      const dy0 = d.y0 + dy, dy1 = d.y1 + dy;
      vertices[vi++] = dx0; vertices[vi++] = dy0;
      vertices[vi++] = dx1; vertices[vi++] = dy0;
      vertices[vi++] = dx0; vertices[vi++] = dy1;
      vertices[vi++] = dx1; vertices[vi++] = dy1;
    }
    const indices = new Uint32Array(rects.length * 6);
    let ii = 0;
    for (let r = 0; r < rects.length; r++) {
      const base = r * 4;
      indices[ii++] = base;     indices[ii++] = base + 1; indices[ii++] = base + 2;
      indices[ii++] = base + 1; indices[ii++] = base + 3; indices[ii++] = base + 2;
    }

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('drawTextDecorations: createVertexArray returned null');
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('drawTextDecorations: createBuffer (VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    const aPosLoc = prog.attribute('a_position');
    if (aPosLoc !== undefined) {
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 8, 0);
    }

    const ibo = gl.createBuffer();
    if (!ibo) throw new Error('drawTextDecorations: createBuffer (IBO) returned null');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

    gl.uniform4f(prog.uniform('u_color')!, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    // Per-draw VAO/VBO/IBO, freed immediately — same as drawTextGroup.
    gl.deleteVertexArray(vao);
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
  }
}

function drawTextGroup(ctx: DrawContext, group: LaidOutGroup, prog: ShaderProgram, dx: number, dy: number): void {
  if (group.source === 'canvas') {
    if (!syncDynamicPageTexture(ctx.textureCache, group.page)) return;
  } else {
    if (!ensureFontTexture(group.family, group.weight, group.style, ctx.textureCache)) return;
  }
  if (group.quads.length === 0) return;

  const gl = ctx.gl;

  // Pack quads into a vertex buffer (stride 20 bytes: x, y, u, v, baselineY floats).
  const vertices = new Float32Array(group.quads.length * 4 * 5);
  let vi = 0;
  for (const q of group.quads) {
    const x0 = q.x0 + dx, x1 = q.x1 + dx;
    const y0 = q.y0 + dy, y1 = q.y1 + dy, by = q.baselineY + dy;
    vertices[vi++] = x0; vertices[vi++] = y0; vertices[vi++] = q.u0; vertices[vi++] = q.v0; vertices[vi++] = by;
    vertices[vi++] = x1; vertices[vi++] = y0; vertices[vi++] = q.u1; vertices[vi++] = q.v0; vertices[vi++] = by;
    vertices[vi++] = x0; vertices[vi++] = y1; vertices[vi++] = q.u0; vertices[vi++] = q.v1; vertices[vi++] = by;
    vertices[vi++] = x1; vertices[vi++] = y1; vertices[vi++] = q.u1; vertices[vi++] = q.v1; vertices[vi++] = by;
  }
  const indices = new Uint32Array(group.quads.length * 6);
  let ii = 0;
  for (let q = 0; q < group.quads.length; q++) {
    const base = q * 4;
    indices[ii++] = base;     indices[ii++] = base + 1; indices[ii++] = base + 2;
    indices[ii++] = base + 1; indices[ii++] = base + 3; indices[ii++] = base + 2;
  }

  const vao = gl.createVertexArray();
  if (!vao) throw new Error('drawTextGroup: createVertexArray returned null');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('drawTextGroup: createBuffer (VBO) returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

  const stride = 20;
  const aPosLoc = prog.attribute('a_position');
  const aUvLoc  = prog.attribute('a_uv');
  const aBaseLoc = prog.attribute('a_baselineY');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }
  if (aBaseLoc !== undefined) {
    gl.enableVertexAttribArray(aBaseLoc);
    gl.vertexAttribPointer(aBaseLoc, 1, gl.FLOAT, false, stride, 16);
  }

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('drawTextGroup: createBuffer (IBO) returned null');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

  // Per-group fill (color uniform).
  let r = 0, g = 0, b = 0, a = 1;
  if ('color' in group.fill) {
    [r, g, b, a] = resolveColor(group.fill.color);
  }
  gl.uniform4f(prog.uniform('u_color')!, r, g, b, a);

  // u_synthBold: SDF threshold shift when the resolver fell back from a
  // missing bold variant to the regular atlas. 0.08 was tuned empirically
  // to thicken Inter strokes ~1px at 16px size without breaking topology.
  const synthBoldAmount = group.synthetic.bold ? 0.08 : 0;
  const uSynthBold = prog.uniform('u_synthBold');
  if (uSynthBold !== undefined) gl.uniform1f(uSynthBold, synthBoldAmount);

  // u_synthItalic: vertex-shader skew angle (radians) applied when the
  // resolver fell back from a missing italic variant to the upright atlas.
  // See SYNTHETIC_ITALIC_RADIANS — shared with the outline tier's CPU shear.
  const synthItalicAmount = group.synthetic.italic ? SYNTHETIC_ITALIC_RADIANS : 0;
  const uSynthItalic = prog.uniform('u_synthItalic');
  if (uSynthItalic !== undefined) gl.uniform1f(uSynthItalic, synthItalicAmount);

  const texId = group.source === 'canvas'
    ? dynamicPageTextureId(group.page)
    : textureCacheKey(group.family, group.weight, group.style);
  ctx.textureCache.bind(texId, 0);
  gl.uniform1i(prog.uniform('u_atlas')!, 0);

  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
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
  // Set per-draw, not at upload: GLImageCache keys textures by bitmap
  // identity, so the same bitmap can be drawn at both filters in one frame.
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    cmd.sampling === 'nearest' ? gl.NEAREST : gl.LINEAR,
  );
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
