import type { Stroke, FillStyle, GradientUnits } from '@weasel-js/paint';
import type { Path } from '@weasel-js/core';
import { getPaintKind } from 'core/paintKinds';
import type { PaintBindContext } from 'core/paintKinds';
import { resolveTextStyle } from '@weasel-js/text';
import type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  SpritesDrawCommand,
  ShaderDrawCommand,
} from './DrawCommand';
import { SPRITE_STRIDE } from './DrawCommand';
import { getTexture, type TextureHandle } from './textures/registerTexture';
import type { ShaderUniform } from './shaders/registerProgram';
import { IDENTITY_COLOR_MATRIX, type GroupState } from './state/GroupState';
import type { GLMeshCache, GLMeshHandle } from './cache/GLMeshCache';
import type { GLTextureCache } from './cache/GLTextureCache';
import type { GLImageCache } from './cache/GLImageCache';
import type { GradientRampAtlas } from './cache/GradientRampAtlas';
import type { ShaderProgram } from './shaders/ShaderProgram';
import { mat3, type Mat3 } from './math/mat3';
import { getMesh } from './cache/cache';
import { tessellate } from 'features/paths/tessellate/tessellate';
import { resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import { resolveColor } from './math/color';
import {
  ensureFontTexture,
  textureCacheKey,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  GLYPH_MODE_MSDF,
  GLYPH_MODE_R8,
} from '@weasel-js/font';
import {
  type LaidOutGroup, type LaidOutDecoration, type LaidOutOutlineGlyph,
} from '@weasel-js/text';
import { verticalAlignOffset, cachedLayoutRuns } from '@weasel-js/text';
import type { Mesh } from './cache/mesh';
import { outlineMesh } from './cache/outlineMeshCache';
import { outlineStrokeMesh, quantizeEmWidth } from './cache/outlineStrokeMeshCache';
import { strokeMesh } from './cache/strokeMeshCache';
import { DrawBatch } from './drawBatch';
import { BATCH_TEXTURE_SLOTS } from './shaders/batchFill';
import type { EffectTarget, EffectTargets } from './effects/EffectTargets';
import { COMPOSITE_PROGRAM_ID } from './effects/composite';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  pathFillVColor: ShaderProgram;
  imageFill: ShaderProgram;
  /** The one program a batch flush draws with — `shaders/batchFill.ts`. */
  batchFill: ShaderProgram;
  gradFill: ShaderProgram;
  patternFill: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRamps: GradientRampAtlas;
  programRegistry: Map<string, ShaderProgram>;
  /** Compile-on-first-use for a registered paint kind's program. Absent when
   *  a caller drives `dispatch` without a renderer behind it. */
  ensureProgram?(id: string): ShaderProgram | null;
  quadVbo: WebGLBuffer | null;
  quadIbo: WebGLBuffer | null;
  /** Staging for the batch. Draws are deferred into it, so a caller driving
   *  `dispatch` itself must `flushBatch` when the stream ends. */
  drawBatch: DrawBatch;
  /** Group state the staged run was built under, and what it samples;
   *  `undefined` while nothing is staged. Written only by the push helpers
   *  and `flushBatch`. */
  batchState?: StagedBatchState;
  /** 1x1 white texture, bound for a flush that samples no image so a solid
   *  vertex's `texture() * color` is its color. */
  whiteTexture: WebGLTexture | null;
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
  /** Offscreen buffers for group effects. Absent when a caller drives
   *  `dispatch` without a renderer behind it, in which case a group's
   *  `effects` are skipped and its children draw straight through — the same
   *  answer an unregistered effect program gets, and the one that keeps a
   *  frame on screen. */
  effectTargets?: EffectTargets;
  /** Where this renderer is currently drawing. `null` is the default
   *  framebuffer. Tracked here rather than read back with `getParameter`
   *  because a group's effects nest, and each has to restore its parent's. */
  renderTarget?: EffectTarget | null;
  /** Device-pixel size of the drawing buffer, which is what an offscreen
   *  target is sized to. */
  deviceWidth?: number;
  deviceHeight?: number;
  /** Put the viewport and scissor back to the renderer's own rect after a
   *  group's effects have borrowed them for a full-buffer pass. The renderer
   *  owns that rect — see `WeaselRenderer.applyTarget` — and a second copy of
   *  its y-flip here would be a second thing to keep in step. */
  restoreTargetRect?(): void;
}

/**
 * Upload the cumulative color matrix from GroupState to a shader's
 * `u_colorMatrix` (mat4) and `u_colorBias` (vec4) uniforms. Splits the 4×5
 * row-major form into a column-major mat4 + vec4 bias. Used by every shader
 * that accepts the group color matrix: pathFill, pathFillVColor, imageFill,
 * batchFill.
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
 * `u_alpha` qualify because every write of them goes through `setColorUniform`
 * / `setAlphaUniform` — keep it that way. A `gl.uniform4f(… 'u_color' …)` added
 * anywhere else leaves the cache believing a value the program no longer has,
 * and the wrong color is drawn until something else moves it.
 */
interface UploadedUniforms {
  proj?: Float32Array;
  model?: Float32Array;
  colorMatrix?: Float32Array;
  colorBias?: Float32Array;
  /** Held as plain numbers, not a `Float32Array`: the caller's values are
   *  doubles, and round-tripping them through float32 would compare unequal
   *  every time and never skip an upload. */
  color?: [number, number, number, number];
  alpha?: number;
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

/**
 * `u_color`, skipped when the program already holds it.
 *
 * Every writer of `u_color` goes through here — see `UploadedUniforms`. The
 * solid batch is what makes it worth caching: it holds the uniform at white
 * forever and flushed once per state change, so a mixed document re-sent the
 * same white a few hundred times a frame.
 */
function setColorUniform(
  ctx: DrawContext, prog: ShaderProgram,
  r: number, g: number, b: number, a: number,
): void {
  const loc = prog.uniform('u_color');
  if (loc === undefined) return;
  const uploaded = uploadedFor(ctx, prog);
  const prev = uploaded.color;
  if (prev !== undefined && prev[0] === r && prev[1] === g && prev[2] === b && prev[3] === a) {
    return;
  }
  ctx.gl.uniform4f(loc, r, g, b, a);
  uploaded.color = [r, g, b, a];
}

/** `u_alpha`, on the same terms as `setColorUniform`. */
function setAlphaUniform(ctx: DrawContext, prog: ShaderProgram, alpha: number): void {
  const loc = prog.uniform('u_alpha');
  if (loc === undefined) return;
  const uploaded = uploadedFor(ctx, prog);
  if (uploaded.alpha === alpha) return;
  ctx.gl.uniform1f(loc, alpha);
  uploaded.alpha = alpha;
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
 * Tessellate a fill honoring ctx.flattenTolerance: default route is the
 * persistent Path-identity cache; a custom tolerance tessellates fresh, because
 * the persistent cache's key does not include tolerance.
 */
function fillMesh(ctx: DrawContext, path: Path): Mesh {
  if (ctx.flattenTolerance !== undefined) {
    return tessellate(path, { flattenTolerance: ctx.flattenTolerance });
  }
  return getMesh(path);
}

/** Upload a mesh for its own draw. A freshly tessellated one rides the
 *  transient pool, freed at end of frame. */
function meshHandle(ctx: DrawContext, mesh: Mesh): GLMeshHandle {
  if (ctx.flattenTolerance !== undefined) return ctx.meshCache.uploadTransient(mesh);
  return ctx.meshCache.handleFor(mesh);
}

function fillMeshHandle(ctx: DrawContext, path: Path): GLMeshHandle {
  return meshHandle(ctx, fillMesh(ctx, path));
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group':  return drawGroup(ctx, cmd);
    case 'path':   return drawPath(ctx, cmd);
    case 'text':   return drawText(ctx, cmd);
    case 'image':  return drawImage(ctx, cmd);
    case 'sprites': return drawSprites(ctx, cmd);
    case 'shader': flushBatch(ctx); return drawShader(ctx, cmd);
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
export function setUniform(
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

/**
 * Draw a group's children into a buffer of their own, run its effects over
 * that buffer, and composite the result back where the group sits.
 *
 * Three things are deliberately not inherited by the offscreen render:
 *
 * - **The clip.** A fresh buffer's stencil is empty, so a child drawn at the
 *   enclosing clip depth would test against bits that were never written and
 *   paint nothing. The enclosing clip belongs on the composite anyway — it
 *   clips the group's result, not the pixels an effect reads — so `clipDepth`
 *   restarts at 0 inside, which also hands nested clips a fresh budget.
 * - **Alpha and color**, for the same reason from the other end: fading on
 *   the way in would give the effect faded pixels to read, and fade them
 *   again on the way out. `pushIsolated` returns what the composite owes.
 * - **The scissor**, which belongs to the renderer's sub-rect within the
 *   default framebuffer and means nothing in a buffer sized to the whole
 *   drawing buffer.
 */
function drawGroupWithEffects(
  ctx: DrawContext,
  cmd: GroupDrawCommand,
  targets: EffectTargets,
  width: number,
  height: number,
): void {
  const gl = ctx.gl;
  // Anything staged belongs to the parent's buffer, not this one.
  flushBatch(ctx);

  const parentTarget = ctx.renderTarget ?? null;
  const parentClipDepth = ctx.clipDepth;
  const scissorWasOn = gl.isEnabled(gl.SCISSOR_TEST);

  let front = targets.acquire(width, height);
  const composited = ctx.state.pushIsolated({ transform: cmd.transform });
  ctx.clipDepth = 0;

  gl.bindFramebuffer(gl.FRAMEBUFFER, front.fbo);
  ctx.renderTarget = front;
  gl.viewport(0, 0, width, height);
  gl.disable(gl.SCISSOR_TEST);
  gl.stencilMask(0xFF);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  for (const child of cmd.children) dispatch(ctx, child);
  flushBatch(ctx);

  // Passes replace rather than blend: each writes every texel of its target
  // from the whole of its source.
  gl.disable(gl.BLEND);
  for (const effect of cmd.effects!) {
    const program = ctx.ensureProgram?.(effect.program.id) ?? null;
    if (!program) {
      warnOnceUniform(effect.program.id, '(program)');
      continue;
    }
    const back = targets.acquire(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, back.fbo);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawFullscreenQuad(ctx, program, front.texture, width, height, effect.uniforms,
      undefined, effect.program.id);
    targets.release(front);
    front = back;
  }
  gl.enable(gl.BLEND);

  // Back to the parent's buffer, and back under its rules.
  ctx.state.pop();
  ctx.clipDepth = parentClipDepth;
  ctx.renderTarget = parentTarget;
  gl.bindFramebuffer(gl.FRAMEBUFFER, parentTarget ? parentTarget.fbo : null);
  if (parentTarget) {
    gl.viewport(0, 0, width, height);
  } else {
    ctx.restoreTargetRect?.();
    if (scissorWasOn) gl.enable(gl.SCISSOR_TEST);
  }

  const composite = ctx.ensureProgram?.(COMPOSITE_PROGRAM_ID) ?? null;
  if (composite) {
    applyClipTest(ctx);
    drawFullscreenQuad(ctx, composite, front.texture, width, height, undefined, {
      alpha: composited.alpha,
      colorMatrix: composited.colorMatrix,
    });
  }
  targets.release(front);
}

/** One pass: the kit quad, `u_source` bound to `texture`, and whatever else
 *  the caller supplies. Leaves no attribute arrays or buffers bound. */
function drawFullscreenQuad(
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

  if (uniforms) {
    // Unit 0 is `u_source`; a consumer texture starts above it.
    const nextTexUnit = { value: 1 };
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = program.uniform(name);
      if (loc === undefined) {
        warnOnceUniform(programId ?? 'effect', name);
        continue;
      }
      setUniform(gl, loc, value, ctx.textureCache, nextTexUnit);
    }
  }

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  if (aPos !== undefined && aPos >= 0) gl.disableVertexAttribArray(aPos);
  if (aUv !== undefined && aUv >= 0) gl.disableVertexAttribArray(aUv);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

export function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  // A group with effects is a render-target boundary rather than another
  // accumulating frame. Without a renderer's buffer pool behind the context
  // there is nowhere to draw, so the effects are skipped and the children
  // paint straight through — a frame missing its blur, not a frame missing.
  if (cmd.effects && cmd.effects.length > 0 && ctx.effectTargets
      && ctx.deviceWidth && ctx.deviceHeight) {
    drawGroupWithEffects(ctx, cmd, ctx.effectTargets, ctx.deviceWidth, ctx.deviceHeight);
    return;
  }
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

/** A path command whose stroke actually paints something. */
type StrokedPathCommand = PathDrawCommand & { stroke: Stroke & { paint: FillStyle } };

function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (cmd.fill) drawPathFill(ctx, cmd);
  // A stroke with no `paint` paints nothing, the way a node's `fill: null`
  // does. Commands arriving from a consumer painter or overlay can carry one.
  if (cmd.stroke?.paint) drawPathStroke(ctx, cmd as StrokedPathCommand);
}

function drawPathFill(ctx: DrawContext, cmd: PathDrawCommand): void {
  const fill = cmd.fill!;
  // Batchable: a solid paint with no per-vertex colors. A rect skips
  // tessellation entirely; anything else stages its mesh. Both also keep
  // animated demos that mint a fresh Path every frame from allocating a GL
  // buffer per frame.
  const isSolid = fill.fill === undefined || fill.fill === 'solid';
  const hasVColors = !!(cmd.vertexColors && cmd.vertexColors.length > 0);
  const solid = fill as { color: string; opacity?: number };

  if (isSolid && !hasVColors && cmd.path.kind === 'rect') {
    pushRect(ctx, cmd.path, solid);
    return;
  }

  const mesh = fillMesh(ctx, cmd.path);
  if (tryStageSolid(ctx, mesh, isSolid && !hasVColors ? solid : undefined)) return;

  const handle = meshHandle(ctx, mesh);
  if (isSolid && hasVColors) {
    drawPathFillVColor(ctx, cmd, solid, handle);
  } else if (handle.requiresStencil) {
    drawPathFillStencil(ctx, fill, handle);
  } else {
    drawPathFillByKind(ctx, fill, handle);
  }
}

/** `u_samplers[i] = i`, uploaded whole per flush. Built once: the mapping from
 *  slot to texture unit is the identity and never varies. */
const SAMPLER_UNITS = new Int32Array(
  Array.from({ length: BATCH_TEXTURE_SLOTS }, (_, i) => i),
);

/**
 * The group state a staged run was built under.
 *
 * A run outlives the group it started in, so the state live when the flush
 * happens is not the state the rects belong to — the flush draws with these
 * values instead. Transform is absent because it rides the vertices; `alpha`
 * is 1 whenever it rode them too.
 */
interface StagedBatchState {
  alpha: number;
  colorMatrix: Float32Array;
  clipDepth: number;
  /**
   * The SDF threshold shift `u_synthBold` draws this run under.
   *
   * A uniform rather than a vertex attribute, and so a thing that breaks a run.
   * Carrying it per vertex measured 9% slower at the densest rung of
   * `tests/perf/atlas-wall.spec.ts` — the batch's whole point is one cheap
   * buffer write a frame, and a float only glyphs read still widens the write
   * for every rect and quad beside them. What it costs instead is a break
   * wherever faked-bold text meets text that is not, which is a fallback path:
   * a registered bold face never sets this at all.
   */
  synthBold: number;
  /** Whether group alpha folded into the vertex colors. */
  foldsAlpha: boolean;
  /**
   * The textures this run samples, in the order they joined. A quad's vertices
   * carry `index + 1`, because slot 0 is the white texel every solid samples.
   *
   * Two kinds, because two caches own them: an image quad names an
   * `ImageBitmap` that `GLImageCache` keys by identity, a glyph names the
   * string id of a font atlas in `GLTextureCache`. They share the slot list so
   * a caption and the thumbnail above it share a draw.
   *
   * A bitmap's `sampling` is per entry and set per flush rather than at upload:
   * MAG_FILTER is state on the texture object, so the same bitmap drawn at both
   * filters in one frame needs two flushes, not two slots. An atlas carries no
   * sampling because `GLTextureCache` owns its filtering — and must keep
   * owning it: filtering a distance field destroys it, so a font atlas is
   * never mipmapped and never joins a shared image atlas.
   */
  textures: BatchTexture[];
}

/** One entry in a run's slot list. */
type BatchTexture =
  | { kind: 'bitmap'; image: ImageBitmap; sampling: 'linear' | 'nearest' }
  | { kind: 'atlas'; id: string };

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
function stagedStateIsLive(
  ctx: DrawContext, staged: StagedBatchState,
  image?: ImageBitmap, sampling?: 'linear' | 'nearest',
  synthBold = 0,
): boolean {
  if (staged.clipDepth !== ctx.clipDepth) return false;
  // Solids and image quads ask with 0, which is what a run of them carries, so
  // this only ever breaks between two kinds of glyph.
  if (staged.synthBold !== synthBold) return false;
  if (!staged.foldsAlpha && staged.alpha !== ctx.state.alpha) return false;
  if (image !== undefined && slotForBitmap(staged, image, sampling!) < 0) return false;
  const colorMatrix = ctx.state.colorMatrix;
  return staged.colorMatrix === colorMatrix || sameValues(staged.colorMatrix, colorMatrix);
}

/**
 * The slot `image` would sample from in this run, or -1 if it cannot join.
 *
 * A bitmap already in the run reuses its slot — but only at the filter it went
 * in under, since MAG_FILTER belongs to the texture object and one draw cannot
 * have it both ways. Otherwise it takes the next free slot, and a run with none
 * left is a run this quad has to break.
 */
function slotForBitmap(
  staged: StagedBatchState, image: ImageBitmap, sampling: 'linear' | 'nearest',
): number {
  for (let i = 0; i < staged.textures.length; i++) {
    const entry = staged.textures[i];
    if (entry.kind !== 'bitmap' || entry.image !== image) continue;
    return entry.sampling === sampling ? i + 1 : -1;
  }
  return nextFreeSlot(staged);
}

/** The same for a font atlas, which has no filter to disagree about. */
function slotForAtlas(staged: StagedBatchState, id: string): number {
  for (let i = 0; i < staged.textures.length; i++) {
    const entry = staged.textures[i];
    if (entry.kind === 'atlas' && entry.id === id) return i + 1;
  }
  return nextFreeSlot(staged);
}

/** The slot a texture new to this run would take, or -1 if it is full. */
function nextFreeSlot(staged: StagedBatchState): number {
  return staged.textures.length + 1 < BATCH_TEXTURE_SLOTS ? staged.textures.length + 1 : -1;
}

/**
 * Vertices above which a mesh keeps its own draw.
 *
 * Batching trades a draw call for copying and re-uploading the mesh every
 * frame, where a mesh already in the persistent cache costs nothing per frame
 * beyond the draw. On an M2 Max via ANGLE (`npm run test:perf`) staged geometry
 * runs ~8.5 ns a vertex and a warm mesh draw ~1.8 us, putting break-even near
 * 200 — and the 1.8 us is an upper bound, measured under heavy overdraw. So
 * this sits about at break-even, where being wrong in either direction is a
 * wash, rather than anywhere a big path pays a per-frame copy for a draw call
 * it barely saves.
 */
const MAX_BATCHED_MESH_VERTICES = 256;

/** Whether a mesh can join a run. Stencil fills need their own two-pass dance,
 *  and a mesh past the cap is cheaper as its own draw. */
function canBatchMesh(mesh: Mesh): boolean {
  return !mesh.requiresStencil && (mesh.vertices.length >> 1) <= MAX_BATCHED_MESH_VERTICES;
}

/**
 * Open or continue a run for `vertices` more, flushing first if the run would
 * overflow or if the live group state no longer matches what it was staged
 * under. Returns the staged state, which the caller reads to resolve alpha.
 *
 * Fill opacity folds into the vertex alpha, exactly as `u_color` carried it
 * when each shape was its own draw. Group alpha folds in too, but only under an
 * identity color matrix: the shader is `a = clamp(CM * src + bias).a * u_alpha`,
 * so with a real matrix between them a pre-multiplied vertex alpha is a
 * different number. There it stays a uniform, and a differing alpha breaks the
 * run as before.
 */
function stageSolid(ctx: DrawContext, vertices: number): StagedBatchState {
  if (ctx.batchState !== undefined && !stagedStateIsLive(ctx, ctx.batchState)) flushBatch(ctx);
  if (ctx.drawBatch.wouldOverflow(vertices)) flushBatch(ctx);
  return openRun(ctx);
}

/** The staged state, opening a run under the live group state if none is. */
function openRun(ctx: DrawContext): StagedBatchState {
  if (ctx.batchState === undefined) {
    const colorMatrix = ctx.state.colorMatrix;
    const foldsAlpha = isIdentityColorMatrix(colorMatrix);
    ctx.batchState = {
      alpha: foldsAlpha ? 1 : ctx.state.alpha,
      colorMatrix,
      clipDepth: ctx.clipDepth,
      synthBold: 0,
      foldsAlpha,
      textures: [],
    };
  }
  return ctx.batchState;
}

/**
 * Open or continue a run for one more image quad, flushing first if the run
 * would overflow or cannot give this bitmap a slot.
 *
 * A run adopts a bitmap it has not seen rather than breaking, which is what
 * lets a wall's ground rect and its atlas quad share a draw, and what lets a
 * cell's art and its badge share one too. Returns the staged state and the slot
 * the quad's vertices must carry.
 */
function stageImage(
  ctx: DrawContext, image: ImageBitmap, sampling: 'linear' | 'nearest',
): { staged: StagedBatchState; slot: number } {
  if (ctx.batchState !== undefined
      && !stagedStateIsLive(ctx, ctx.batchState, image, sampling)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForBitmap(staged, image, sampling);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'bitmap', image, sampling });
    slot = staged.textures.length;
  }
  return { staged, slot };
}

/**
 * Open or continue a run for a glyph off the font atlas `atlasId`, flushing
 * first if the run would overflow or has no slot left for it.
 *
 * The atlas is the unit of coalescing the way a sprite sheet is: every glyph a
 * face contributes to a frame shares one texture, so a paragraph is one run
 * however many glyphs it is, and a second face costs one more slot rather than
 * a flush per word.
 */
function stageGlyphs(
  ctx: DrawContext, atlasId: string, synthBold: number,
): { staged: StagedBatchState; slot: number } {
  if (ctx.batchState !== undefined
      && (!stagedStateIsLive(ctx, ctx.batchState, undefined, undefined, synthBold)
          || slotForAtlas(ctx.batchState, atlasId) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  // An empty run adopts the threshold; one that already has vertices agreed to
  // it above, since a mismatch flushed.
  staged.synthBold = synthBold;
  let slot = slotForAtlas(staged, atlasId);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'atlas', id: atlasId });
    slot = staged.textures.length;
  }
  return { staged, slot };
}

/** Straight-alpha rgba for a solid paint under the staged state. */
function stagedColor(
  ctx: DrawContext, staged: StagedBatchState,
  paint: { color: string; opacity?: number },
): [number, number, number, number] {
  const [r, g, b, a] = resolveColor(paint.color);
  return [r, g, b, a * (paint.opacity ?? 1) * (staged.foldsAlpha ? ctx.state.alpha : 1)];
}

function pushRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  fill: { color: string; opacity?: number },
): void {
  const staged = stageSolid(ctx, 4);
  const [r, g, b, a] = stagedColor(ctx, staged, fill);
  ctx.drawBatch.pushRect(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform, r, g, b, a,
  );
}

function pushMesh(
  ctx: DrawContext,
  mesh: Mesh,
  paint: { color: string; opacity?: number },
): void {
  const staged = stageSolid(ctx, mesh.vertices.length >> 1);
  const [r, g, b, a] = stagedColor(ctx, staged, paint);
  ctx.drawBatch.pushMesh(mesh, ctx.state.transform, r, g, b, a);
}

/**
 * Stage `mesh` into the run, or drain the run so the caller can draw it itself.
 *
 * `true` means the mesh is in the batch and the caller is done. `false` comes
 * back only *after* a flush, so an emitter cannot earn permission to draw for
 * itself without also draining the batch. `paint` is `undefined` when the paint
 * is not a plain solid (gradient, pattern, per-vertex colors), which no run can
 * express.
 */
export function tryStageSolid(
  ctx: DrawContext,
  mesh: Mesh,
  paint: { color: string; opacity?: number } | undefined,
): boolean {
  if (paint !== undefined && canBatchMesh(mesh)) {
    pushMesh(ctx, mesh, paint);
    return true;
  }
  flushBatch(ctx);
  return false;
}

/**
 * Draw the staged run as one `drawElements`, under the state it was staged
 * under. Callers that are about to bind a different program, or paint anything
 * that must land on top of the run, call this first; a group that only changes
 * the color matrix does not, because `pushRect` notices and flushes then, and
 * one that only changes transform or alpha does not break the run at all.
 *
 * Clips are the exception both ways: the stencil is real GL state that the
 * staged values cannot reconstruct, so `pushClip` and `popClip` flush *before*
 * mutating it rather than leaving it to the next push.
 *
 * `u_color` stays white: the vertex-color program multiplies it by the
 * per-vertex color, so white makes the result bit-identical to the flat
 * program's `u_color`-only math. `u_model` stays identity for the same reason —
 * the corners arrive already transformed.
 */
export function flushBatch(ctx: DrawContext): void {
  const batch = ctx.drawBatch;
  const staged = ctx.batchState;
  if (batch.length === 0 || staged === undefined) return;
  const gl = ctx.gl;
  const prog = ctx.batchFill;
  gl.useProgram(prog.handle);
  const indexCount = batch.uploadAndBind();
  setProjAndModel(ctx, prog, BATCH_MODEL);
  setColorUniform(ctx, prog, 1, 1, 1, 1);
  setAlphaUniform(ctx, prog, staged.alpha);
  gl.uniform1f(prog.uniform('u_synthBold')!, staged.synthBold);
  setColorMatrixUniforms(ctx, prog, staged.colorMatrix);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ctx.whiteTexture);
  for (let i = 0; i < staged.textures.length; i++) {
    const entry = staged.textures[i];
    if (entry.kind === 'atlas') {
      ctx.textureCache.bind(entry.id, i + 1);
      continue;
    }
    ctx.imageCache.bind(entry.image, i + 1);
    // Per flush, not at upload: the same bitmap can be drawn at both filters in
    // one frame. The cache skips the write when the texture already carries the
    // value, which is most flushes.
    ctx.imageCache.setMagFilter(
      entry.image,
      entry.sampling === 'nearest' ? gl.NEAREST : gl.LINEAR,
    );
  }
  gl.uniform1iv(prog.uniform('u_samplers')!, SAMPLER_UNITS);
  applyClipTest(ctx, staged.clipDepth);
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
  // Everything else in the renderer binds its texture to unit 0 and some of it
  // does so without an `activeTexture` of its own, so leaving unit 6 selected
  // sends the next such bind to a unit nothing samples.
  gl.activeTexture(gl.TEXTURE0);
  // Not redundant: `drawShader` binds no VAO and points attributes at whatever
  // is current, so a slot left bound here comes back corrupted a ring later.
  gl.bindVertexArray(null);
  batch.reset();
  ctx.batchState = undefined;
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
  const [r, g, b, a] = resolveColor(color);
  setColorUniform(ctx, prog, r, g, b, a * (opacity ?? 1));
  setAlphaUniform(ctx, prog, ctx.state.alpha);
}

/**
 * Bind the program, uniforms and textures for `fill`, and return the program.
 *
 * Split from the draw so a caller owning its own stencil state can paint
 * without `applyClipTest` clobbering it — `drawPathStrokeStenciled` clips a
 * doubled ribbon to one side of the silhouette, and `applyClipTest` at depth 0
 * disables the stencil test outright.
 */
function bindPathFillByKind(ctx: DrawContext, fill: FillStyle): ShaderProgram | null {
  const kind = fill.fill ?? 'solid';
  if (kind === 'solid') return bindPathFillSolid(ctx, fill as { color: string; opacity?: number });
  if (kind === 'pattern') return bindPathFillPattern(ctx, fill as Extract<FillStyle, { fill: 'pattern' }>);
  if (kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'conic-gradient') {
    return bindPathFillGradient(ctx, fill as Extract<FillStyle, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>);
  }
  const bind = getPaintKind(kind)?.bind;
  return bind ? bind(paintBindContext(ctx), fill) : null;
}

/** The narrow renderer surface a registered paint kind binds against, built
 *  once per frame context. `DrawContext` is not consumer surface. */
function paintBindContext(ctx: DrawContext): PaintBindContext {
  const cached = BIND_CONTEXTS.get(ctx);
  if (cached) return cached;
  const made: PaintBindContext = {
    gl: ctx.gl,
    get alpha() { return ctx.state.alpha; },
    program: (id) => ctx.ensureProgram?.(id) ?? ctx.programRegistry.get(id) ?? null,
    setProjAndModel: (prog) => setProjAndModel(ctx, prog),
    spaceInverse: (units) => gradientSpaceInverse(ctx, units),
    bindRamp: (stops, unit) => {
      const row = ctx.gradRamps.upload(stops);
      ctx.gradRamps.bind(unit);
      return ctx.gradRamps.rowV(row);
    },
  };
  BIND_CONTEXTS.set(ctx, made);
  return made;
}

const BIND_CONTEXTS = new WeakMap<DrawContext, PaintBindContext>();

function drawPathFillByKind(ctx: DrawContext, fill: FillStyle, handle: GLMeshHandle): void {
  const prog = bindPathFillByKind(ctx, fill);
  if (!prog) return;
  const gl = ctx.gl;
  gl.bindVertexArray(handle.vao);
  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function bindPathFillSolid(
  ctx: DrawContext,
  fill: { color: string; opacity?: number },
): ShaderProgram {
  const prog = ctx.pathFill;
  ctx.gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);
  return prog;
}

function bindPathFillPattern(
  ctx: DrawContext,
  fill: Extract<FillStyle, { fill: 'pattern' }>,
): ShaderProgram | null {
  const tex = fill.pattern as TextureHandle;
  const entry = getTexture(tex.id);
  if (!entry) {
    const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
    if (isDev) console.warn(`weasel: pattern TextureHandle "${tex.id}" not registered`);
    return null;
  }
  ctx.textureCache.upload(tex.id, entry.source, 'repeat');

  // A path fill mesh carries a_position only, so the tile coordinate is
  // recovered per fragment from the screen position — the same route
  // gradients take through `u_worldInv`, and the reason this can't reuse
  // the image-fill shader, whose a_uv such a mesh leaves unbound.
  const gl = ctx.gl;
  gl.useProgram(ctx.patternFill.handle);
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
  setAlphaUniform(ctx, ctx.patternFill, ctx.state.alpha);
  return ctx.patternFill;
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

function bindPathFillGradient(
  ctx: DrawContext,
  fill: Extract<FillStyle, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>,
): ShaderProgram {
  const gl = ctx.gl;
  const row = ctx.gradRamps.upload(fill.stops);

  gl.useProgram(ctx.gradFill.handle);
  setProjAndModel(ctx, ctx.gradFill);

  gl.uniformMatrix3fv(ctx.gradFill.uniform('u_worldInv')!, false, gradientSpaceInverse(ctx, fill.units));

  ctx.gradRamps.bind(0);
  gl.uniform1i(ctx.gradFill.uniform('u_ramp')!, 0);
  gl.uniform1f(ctx.gradFill.uniform('u_rampV')!, ctx.gradRamps.rowV(row));
  setAlphaUniform(ctx, ctx.gradFill, ctx.state.alpha);
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

  return ctx.gradFill;
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
  // First, not last: a run staged outside the clip would otherwise draw under
  // a mask it never had.
  flushBatch(ctx);
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
  // First, not last: past here the mask is gone, and these pixels belonged
  // inside it.
  flushBatch(ctx);
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
  // The paint binds here, not above: pass 1 runs under a false colorMask, so a
  // uniform missed here renders black while the GL-recorder tests still pass.
  // Not `drawPathFillByKind` — its `applyClipTest` would disable this stencil.
  if (bindPathFillByKind(ctx, fill)) {
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  }

  // Narrow to bit 0 first: clear only zeroes bits the mask enables, and
  // pushClip owns bits 1-7.
  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

/** `cmd` with a `{ px }` stroke width resolved against the accumulated
 *  transform, so everything downstream — the ribbon cache key included — sees
 *  a world-unit number. */
function withResolvedStrokeWidth(ctx: DrawContext, cmd: StrokedPathCommand): StrokedPathCommand {
  const stroke = cmd.stroke;
  if (typeof stroke.width !== 'object') return cmd;
  const width = resolveStrokeWidth(stroke.width, mat3.meanScaleOf(ctx.state.transform));
  return { ...cmd, stroke: { ...stroke, width } };
}

function drawPathStroke(ctx: DrawContext, rawCmd: StrokedPathCommand): void {
  const cmd = withResolvedStrokeWidth(ctx, rawCmd);
  const stroke = cmd.stroke;
  const align = stroke.align ?? 'center';
  if (cmd.path.kind === 'polygon' && align !== 'center') {
    flushBatch(ctx);
    drawPathStrokeStenciled(ctx, cmd, align);
    return;
  }

  drawPathStrokeUnclipped(ctx, cmd);
}

function drawPathStrokeUnclipped(ctx: DrawContext, cmd: StrokedPathCommand): void {
  const stroke = cmd.stroke;
  const paint = stroke.paint;
  const isSolid = paint.fill === undefined || paint.fill === 'solid';
  const solid = paint as { color: string; opacity?: number };
  const mesh = strokeMesh(cmd.path, stroke, ctx.flattenTolerance);
  if (mesh.indices.length === 0) return;

  // Staged, a ribbon allocates nothing and joins the fill it sits on.
  const hasVColors = !!(stroke.vertexColors && stroke.vertexColors.length > 0);
  if (tryStageSolid(ctx, mesh, isSolid && !hasVColors ? solid : undefined)) return;

  // The VAO records the per-draw color attribute, so a vertex-colored draw
  // cannot share a persistent one with a draw that has no vertex colors.
  const handle = hasVColors
    ? ctx.meshCache.uploadTransient(mesh)
    : ctx.meshCache.uploadRecurring(mesh);

  if (!isSolid && !hasVColors) {
    drawPathFillByKind(ctx, paint, handle);
    return;
  }

  const gl = ctx.gl;
  if (hasVColors) {
    const prog = ctx.pathFillVColor;
    gl.useProgram(prog.handle);
    gl.bindVertexArray(handle.vao);
    setProjAndModel(ctx, prog);
    // Per-vertex colors are the paint here; a non-solid base has no single
    // color to multiply by, so white leaves the vertex colors unmodified.
    setSolidPaintUniforms(ctx, prog, isSolid ? solid.color : '#ffffff', paint.opacity);
    setColorMatrixUniforms(ctx, prog);

    const expanded = expandAnchorColors(stroke.vertexColors!, handle);
    const colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathStrokeUnclipped: createBuffer (color VBO) returned null');
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

/** The ribbon cache compares `vertexWidths` by reference, so the doubled copy
 *  has to be the same array on every frame the source array is. */
const DOUBLED_VERTEX_WIDTHS = new WeakMap<number[], number[]>();

function doubledVertexWidths(widths: number[]): number[] {
  let doubled = DOUBLED_VERTEX_WIDTHS.get(widths);
  if (doubled === undefined) {
    doubled = widths.map((w) => w * 2);
    DOUBLED_VERTEX_WIDTHS.set(widths, doubled);
  }
  return doubled;
}

function drawPathStrokeStenciled(
  ctx: DrawContext,
  cmd: StrokedPathCommand,
  align: 'inner' | 'outer',
): void {
  const stroke = cmd.stroke;
  const paint = stroke.paint;
  const isSolid = paint.fill === undefined || paint.fill === 'solid';
  const solid = paint as { color: string; opacity?: number };
  const widerStroke: Stroke = {
    ...stroke,
    width: resolveStrokeWidth(stroke.width ?? 1, 1) * 2,
    ...(stroke.vertexWidths ? { vertexWidths: doubledVertexWidths(stroke.vertexWidths) } : {}),
    align: 'center',
  };

  const useVColor = !!(stroke.vertexColors && stroke.vertexColors.length > 0);

  const fillHandle = fillMeshHandle(ctx, cmd.path);
  const ribbonMesh = strokeMesh(cmd.path, widerStroke, ctx.flattenTolerance);
  if (ribbonMesh.indices.length === 0) return;
  // The VAO records the per-draw color attribute, so a vertex-colored draw
  // cannot share a persistent one with a draw that has no vertex colors.
  const ribbonHandle = useVColor
    ? ctx.meshCache.uploadTransient(ribbonMesh)
    : ctx.meshCache.uploadRecurring(ribbonMesh);

  const gl = ctx.gl;
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
  // Bind the paint here rather than through `drawPathFillByKind`: that calls
  // `applyClipTest`, which at clip depth 0 disables the stencil test this
  // function just set up to clip the ribbon to one side.
  let ribbonProg: ShaderProgram | null = prog;
  if (useVColor) {
    // Per-vertex colors are the paint here; a non-solid base has no single
    // color to multiply by, so white leaves the vertex colors unmodified.
    setSolidPaintUniforms(ctx, prog, isSolid ? solid.color : '#ffffff', paint.opacity);
    setColorMatrixUniforms(ctx, prog);
  } else {
    ribbonProg = bindPathFillByKind(ctx, paint);
  }
  if (!ribbonProg) {
    gl.stencilMask(0x01);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.STENCIL_TEST);
    gl.bindVertexArray(null);
    return;
  }
  gl.bindVertexArray(ribbonHandle.vao);

  let colorVbo: WebGLBuffer | null = null;
  if (useVColor) {
    const expanded = expandAnchorColors(stroke.vertexColors!, ribbonHandle);
    colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathStrokeStenciled: createBuffer (color VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
    gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
    const aVColorLoc = ribbonProg.attribute('a_vertexColor');
    if (aVColorLoc !== undefined) {
      gl.enableVertexAttribArray(aVColorLoc);
      gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
    }
  }

  gl.drawElements(gl.TRIANGLES, ribbonHandle.indexCount, gl.UNSIGNED_INT, 0);

  // Narrow to bit 0 first: clear only zeroes bits the mask enables, and
  // pushClip owns bits 1-7.
  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
  // Delete after the unbind: deleting a bound buffer leaves its attribute
  // enabled and pointing at nothing, recorded in whatever VAO is live.
  if (colorVbo) gl.deleteBuffer(colorVbo);
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

  for (const group of laid.groups) {
    if (group.source === 'outline') drawTextOutlineGroup(ctx, group, dx, dy);
    else drawTextGroup(ctx, group, dx, dy);
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
 * paragraph set in one face and color is one draw call — the same batching
 * the atlas tier gets from packing glyphs into one texture. The alternative,
 * a model matrix per glyph, would be a draw call per glyph.
 *
 * Going through `drawPathFillByKind` rather than straight to `pathFill` is
 * what makes gradient- and pattern-filled text fall out for free: a glyph
 * here is geometry like any other, and those programs shade in world space,
 * so they need nothing from the text pipeline.
 */
function drawTextOutlineGroup(ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number): void {
  const fill = group.fill;
  if (fill !== null) {
    const mesh = outlineGroupMesh(group, dx, dy);
    if (mesh) drawOutlineMesh(ctx, fill, mesh);
  }

  // Stroke after fill — Canvas2D's fillText-then-strokeText convention, and
  // SVG's default paint-order. A second batched draw call over the same
  // group, not a call per glyph.
  const strokePaint = group.stroke?.paint;
  if (!strokePaint) return;
  const ribbon = outlineGroupStrokeMesh(group, dx, dy, mat3.meanScaleOf(ctx.state.transform));
  if (ribbon) drawOutlineMesh(ctx, strokePaint, ribbon);
}

/**
 * Paint one merged glyph-outline mesh, staging it where it fits.
 *
 * Through `tryStageSolid` rather than straight to `drawPathFillByKind`,
 * because a paragraph can mix tiers: a heading drawn as outlines and a caption
 * drawn from the atlas are groups of one command, and the atlas half now
 * stages. An outline that painted itself while glyphs sat staged behind it
 * would come out under them.
 */
function drawOutlineMesh(ctx: DrawContext, fill: FillStyle, mesh: Mesh): void {
  const isSolid = fill.fill === undefined || fill.fill === 'solid';
  const solid = isSolid ? (fill as { color: string; opacity?: number }) : undefined;
  if (tryStageSolid(ctx, mesh, solid)) return;
  drawPathFillByKind(ctx, fill, ctx.meshCache.uploadTransient(mesh));
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
function outlineGroupStrokeMesh(
  group: LaidOutGroup,
  dx: number,
  dy: number,
  scale: number,
): Mesh | null {
  const stroke = group.stroke;
  if (!stroke) return null;
  const width = resolveStrokeWidth(stroke.width ?? 1, scale);
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
 * instead, batched by resolved color so a whole decorated paragraph costs
 * one draw call per distinct rule color.
 *
 * Drawn after the glyphs, so a rule sits on top of glyph ink where they
 * overlap (the CSS spec allows either order).
 */
/**
 * Stage the rules an underline, strikethrough or overline asks for.
 *
 * Color resolution matches `drawTextGroup` exactly — including its ignoring
 * of `fill.opacity` — so a rule can never disagree with the glyphs it
 * underlines. They stage as ordinary rects, which is what keeps them in the
 * run their glyphs are in.
 */
function drawTextDecorations(
  ctx: DrawContext, decorations: readonly LaidOutDecoration[], dx: number, dy: number,
): void {
  for (const d of decorations) {
    const [r, g, b, a] = 'color' in d.fill ? resolveColor(d.fill.color) : [0, 0, 0, 1];
    const staged = stageSolid(ctx, 4);
    ctx.drawBatch.pushRect(
      d.x0 + dx, d.y0 + dy, d.x1 - d.x0, d.y1 - d.y0, ctx.state.transform,
      r, g, b, a * (staged.foldsAlpha ? ctx.state.alpha : 1),
    );
  }
}

/**
 * Amount `a_synthBold` shifts the SDF threshold by when the resolver fell back
 * from a missing bold variant to the regular atlas. Tuned on Inter: it
 * thickens strokes about a pixel at 16px without breaking glyph topology.
 */
const SYNTH_BOLD_AMOUNT = 0.08;

/**
 * Stage one group of atlas glyphs into the batch.
 *
 * Everything that used to be a uniform per group rides the vertices instead —
 * the text color, and the atlas as a slot index packed with the paint mode — so
 * a run off a baked MSDF atlas and one off the runtime canvas bake belong to
 * the same draw, and so does whatever else the page put around them. The
 * synthetic-bold threshold is the exception, and `StagedBatchState.synthBold`
 * says why.
 *
 * The synthetic oblique is the one that changes shape rather than home: the
 * old program skewed in the vertex stage against `u_synthItalic`, and the
 * batch places its own corners, so `pushGlyph` shears them as it places them.
 */
function drawTextGroup(
  ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number,
): void {
  if (group.source === 'canvas') {
    if (!syncDynamicPageTexture(ctx.textureCache, group.page)) return;
  } else {
    if (!ensureFontTexture(group.family, group.weight, group.style, ctx.textureCache)) return;
  }
  if (group.quads.length === 0) return;

  const atlasId = group.source === 'canvas'
    ? dynamicPageTextureId(group.page)
    : textureCacheKey(group.family, group.weight, group.style);
  const mode = group.source === 'canvas' ? GLYPH_MODE_R8 : GLYPH_MODE_MSDF;
  const bold = group.synthetic.bold ? SYNTH_BOLD_AMOUNT : 0;
  const tanItalic = group.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
  const color = group.fill !== null && 'color' in group.fill
    ? resolveColor(group.fill.color)
    : [0, 0, 0, 1];

  const batch = ctx.drawBatch;
  const m = ctx.state.transform;
  let { staged, slot } = stageGlyphs(ctx, atlasId, bold);
  let alpha = color[3] * (staged.foldsAlpha ? ctx.state.alpha : 1);

  for (const q of group.quads) {
    if (batch.wouldOverflow(4)) {
      flushBatch(ctx);
      ({ staged, slot } = stageGlyphs(ctx, atlasId, bold));
      alpha = color[3] * (staged.foldsAlpha ? ctx.state.alpha : 1);
    }
    batch.pushGlyph(
      q.x0 + dx, q.y0 + dy, q.x1 + dx, q.y1 + dy, q.baselineY + dy, tanItalic, m,
      q.u0, q.v0, q.u1, q.v1,
      color[0], color[1], color[2], alpha,
      slot, mode,
    );
  }
}

/**
 * Stage one image quad. Nothing reaches the GPU here — `flushBatch` draws the
 * run this joins.
 *
 * The upload has to happen now rather than at flush: a run is keyed on bitmap
 * identity, and `flushBatch` binds a texture it assumes already exists.
 */
function drawImage(ctx: DrawContext, cmd: ImageDrawCommand): void {
  ctx.imageCache.upload(cmd.image, cmd.image);
  const { staged, slot } = stageImage(ctx, cmd.image, cmd.sampling ?? 'linear');

  // Sampling window: the whole bitmap unless `source` narrows it, with the
  // flips applied by swapping the ends rather than moving the quad.
  const src = cmd.source;
  let u0 = 0, v0 = 0, u1 = 1, v1 = 1;
  if (src) {
    const tw = cmd.image.width, th = cmd.image.height;
    u0 = src.x / tw; u1 = (src.x + src.w) / tw;
    v0 = src.y / th; v1 = (src.y + src.h) / th;
  }
  if (cmd.flipX) { const t = u0; u0 = u1; u1 = t; }
  if (cmd.flipY) { const t = v0; v0 = v1; v1 = t; }

  ctx.drawBatch.pushQuad(
    cmd.x, cmd.y, cmd.w, cmd.h, ctx.state.transform,
    u0, v0, u1, v1,
    // Group alpha rides the vertices only where it rode the solid colors too:
    // with a real color matrix in the run it is `u_alpha`, and folding it here
    // as well would apply it twice.
    (cmd.opacity ?? 1) * (staged.foldsAlpha ? ctx.state.alpha : 1),
    slot,
  );
}

/**
 * Stage a packed run of sprites. The same staging `drawImage` does, minus a
 * command object per quad — see `SpritesDrawCommand`.
 *
 * The run is opened once and reopened only when the per-flush cap forces a
 * chunk, so the state check that costs a command its own run happens twice in
 * a frame rather than twenty thousand times.
 */
function drawSprites(ctx: DrawContext, cmd: SpritesDrawCommand): void {
  const data = cmd.sprites;
  const count = Math.floor(data.length / SPRITE_STRIDE);
  if (count === 0) return;

  ctx.imageCache.upload(cmd.image, cmd.image);
  const sampling = cmd.sampling ?? 'linear';
  let { staged, slot } = stageImage(ctx, cmd.image, sampling);

  const batch = ctx.drawBatch;
  const m = ctx.state.transform;
  let groupAlpha = staged.foldsAlpha ? ctx.state.alpha : 1;
  const tw = cmd.image.width;
  const th = cmd.image.height;

  for (let s = 0, i = 0; s < count; s++, i += SPRITE_STRIDE) {
    if (batch.wouldOverflow(4)) {
      flushBatch(ctx);
      ({ staged, slot } = stageImage(ctx, cmd.image, sampling));
      groupAlpha = staged.foldsAlpha ? ctx.state.alpha : 1;
    }
    const sx = data[i + 4], sy = data[i + 5], sw = data[i + 6], sh = data[i + 7];
    batch.pushQuad(
      data[i], data[i + 1], data[i + 2], data[i + 3], m,
      sx / tw, sy / th, (sx + sw) / tw, (sy + sh) / th,
      data[i + 8] * groupAlpha, slot,
    );
  }
}

export { mat3, getMesh };
