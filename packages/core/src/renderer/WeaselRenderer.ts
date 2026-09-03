import { ShaderProgram } from './shaders/ShaderProgram';
import {
  VERT_SRC,
  FRAG_SRC,
  VCOLOR_VERT_SRC,
  VCOLOR_FRAG_SRC,
  PATH_FILL_UNIFORMS,
  PATH_FILL_ATTRIBUTES,
  PATH_FILL_VCOLOR_ATTRIBUTES,
} from './shaders/pathFill';
import {
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_FRAG_R8_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
  markAllFontsNotUploaded,
  resetBakeBudget,
  DEFAULT_BAKE_BUDGET,
} from '@weasel-js/font';
import {
  IMAGE_VERT_SRC,
  IMAGE_FRAG_SRC,
  IMAGE_FILL_UNIFORMS,
  IMAGE_FILL_ATTRIBUTES,
} from './shaders/imageFill';
import {
  GRAD_VERT_SRC,
  GRAD_FRAG_SRC,
  GRAD_FILL_UNIFORMS,
  GRAD_FILL_ATTRIBUTES,
} from './shaders/gradFill';
import {
  PATTERN_VERT_SRC,
  PATTERN_FRAG_SRC,
  PATTERN_FILL_UNIFORMS,
  PATTERN_FILL_ATTRIBUTES,
} from './shaders/patternFill';
import { GLMeshCache } from './cache/GLMeshCache';
import { GLTextureCache } from './cache/GLTextureCache';
import { GLImageCache, type ImageMinification } from './cache/GLImageCache';
import { GradientRampCache } from './cache/GradientRampCache';
import { GroupState } from './state/GroupState';
import type { DrawCommand } from './DrawCommand';
import type { Mat3 } from './math/mat3';
import {
  dispatch, flushSolids, disposeImageQuads, disposeTextQuads, OUTLINE_MIN_SCREEN_PX, type DrawContext,
} from './draw';
import { SolidBatch } from './solidBatch';
import {
  CUSTOM_VERT_SRC, CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS,
  QUAD_VERTICES, QUAD_INDICES,
} from './shaders/customPrelude';
import { getProgramSource, type ShaderProgramHandle } from './shaders/registerProgram';

/** Qualifiers GLSL allows between `uniform` and the type name. Skipping them
 *  is not cosmetic: `uniform highp float u_t;` used to match nothing at all,
 *  so the uniform got no location and every write to it was dropped in
 *  silence. */
const UNIFORM_QUALIFIER = /^(?:lowp|mediump|highp|precise|invariant|centroid|flat|smooth|noperspective)$/;

/**
 * Uniform names a custom program declares, expanded per array slot
 * (`u_ripples[0]`, `u_ripples[1]`, …) since that is how a caller binds them.
 *
 * A regex scan, not a parser: it reads a declarator list (`float a, b;`) and
 * skips precision / interpolation qualifiers, but knows nothing of
 * preprocessor branches, struct uniforms, or interface blocks.
 */
function extractUniformNames(glsl: string): string[] {
  const re = /\buniform\s+([^;{]+);/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(glsl)) !== null) {
    const words = m[1].trim().split(/\s+/);
    // Drop qualifiers, then the type, leaving the declarator list. The list
    // can still carry whitespace around its commas, so rejoin before split.
    let i = 0;
    while (i < words.length && UNIFORM_QUALIFIER.test(words[i])) i++;
    i++; // the type
    const declarators = words.slice(i).join(' ');
    if (!declarators) continue;
    for (const raw of declarators.split(',')) {
      const d = raw.trim();
      const arr = /^(\w+)\s*\[\s*(\d+)\s*\]$/.exec(d);
      if (arr) {
        const size = parseInt(arr[2], 10);
        for (let k = 0; k < size; k++) names.push(`${arr[1]}[${k}]`);
      } else if (/^\w+$/.test(d)) {
        names.push(d);
      }
    }
  }
  return names;
}

/** @internal Test helper — exported so the regex behavior can be unit-tested. */
export function _extractUniformNamesForTests(glsl: string): string[] {
  return extractUniformNames(glsl);
}

/** How to construct a `WeaselRenderer`: the GL context or canvas to draw
 *  into, the output size, and the quality knobs that separate screen
 *  rendering from print. */
export interface WeaselRendererOptions {
  gl?: WebGL2RenderingContext;
  canvas?: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
  /** MIN_FILTER strategy for image/pattern textures (`GLImageCache`).
   *  Default `'linear'` — the existing screen behavior. The headless
   *  `renderSceneToPixels` path passes `'mipmap'` for print-quality
   *  minification. Explicitly passing `'linear'` is always valid. */
  imageMinification?: ImageMinification;
  /** Flatness tolerance for curve tessellation, in WORLD units (see
   *  `TessellateOptions.flattenTolerance`). When set, path fills are
   *  tessellated fresh at this tolerance per frame (transient pool) instead
   *  of served from the Path-identity mesh cache — the cache key does not
   *  include tolerance. Default: unset — the existing cached behavior at
   *  `DEFAULT_FLATTEN_TOLERANCE`. The headless path derives this from the
   *  requested output scale; screen callers normally leave it unset. */
  flattenTolerance?: number;
  /** Per-render synchronous bake budget for dynamic canvas-SDF glyphs.
   *  Default DEFAULT_BAKE_BUDGET (16). The headless renderSceneToPixels
   *  path passes Infinity so print never defers a glyph. */
  bakeBudget?: number;
  /** On-screen glyph size, in CSS pixels, at or above which text renders from
   *  tessellated font outlines instead of a distance field — see
   *  `OUTLINE_MIN_SCREEN_PX`. Only faces registered with
   *  `registerFontOutlines` are affected; everything else keeps its SDF tier
   *  whatever this says. Pass `Infinity` to disable the tier outright, or 0
   *  to use outlines wherever they exist (what the headless path does, since
   *  print has no reason to sample a field it could evaluate exactly). */
  textOutlineMinScreenSize?: number;
}

/** Where a renderer draws inside a buffer it does not own.
 *
 *  The rect's SIZE is the renderer's own `width`/`height` — `resize()` owns
 *  that, and a second copy here could disagree with the one `DrawContext`
 *  reports to screen-space layers. */
export interface RenderTarget {
  /** Top-left of this renderer's output within the drawing buffer, in CSS
   *  pixels, with the origin at the buffer's top-left. GL's bottom-left origin
   *  is handled internally. */
  origin: { x: number; y: number };
  /** Clear colour and stencil within the rect before drawing. Default true.
   *  Pass false only when the caller clears the whole buffer itself on behalf
   *  of every co-tenant — a frame that clears neither inherits its neighbour's
   *  stencil bits, and even-odd fills then fill their holes. */
  clear?: boolean;
}

/**
 * The WebGL2 renderer: takes a list of draw commands and paints them.
 *
 * It knows nothing about the scene — commands are the whole interface, which
 * is what lets layers, HUD widgets and overlays all draw through the same
 * pipeline. GPU resources (meshes, textures, gradient ramps) are cached across
 * frames and keyed by identity, so re-issuing the same command is cheap.
 */
export class WeaselRenderer {
  private readonly gl: WebGL2RenderingContext;
  private pathFill: ShaderProgram;
  private pathFillVColor: ShaderProgram;
  private textSdf: ShaderProgram;
  private textSdfR8: ShaderProgram;
  private imageFill: ShaderProgram;
  private gradFill: ShaderProgram;
  private patternFill: ShaderProgram;
  private meshCache: GLMeshCache;
  private textureCache: GLTextureCache;
  private imageCache: GLImageCache;
  private gradRampCache: GradientRampCache;
  private programRegistry = new Map<string, ShaderProgram>();
  private quadVbo: WebGLBuffer | null = null;
  private quadIbo: WebGLBuffer | null = null;
  private solidBatch: SolidBatch;
  private readonly groupState = new GroupState();
  private widthCss: number;
  private heightCss: number;
  private dpr: number;
  private canvas: HTMLCanvasElement | null = null;
  private target: RenderTarget | null = null;
  private readonly imageMinification: ImageMinification;
  private readonly flattenTolerance?: number;
  private readonly bakeBudget: number;
  private readonly textOutlineMinScreenSize: number;
  private contextLost = false;
  private boundOnLost = (e: Event) => this.onContextLost(e);
  private boundOnRestored = () => this.onContextRestored();
  /** True after `dispose()`. A disposed renderer ignores further `render()`
   *  calls and `registerProgram()` calls. */
  private disposed = false;

  constructor(opts: WeaselRendererOptions) {
    if (!opts.gl && !opts.canvas) {
      throw new Error('WeaselRenderer requires either gl or canvas');
    }
    const gl = opts.gl ?? opts.canvas!.getContext('webgl2', { stencil: true });
    if (!gl) throw new Error('WeaselRenderer: WebGL2 not available');
    this.gl = gl as WebGL2RenderingContext;

    // Bits 0-7 are load-bearing: bit 0 for even-odd fills and stenciled
    // strokes, bits 1-7 for clip depth (`renderer/draw.ts`). Without a stencil
    // buffer both render wrong rather than not at all, so refuse the context
    // instead of painting a plausible lie. A stub that cannot answer is not a
    // stencil-less context — only an explicit `false` is.
    const attrs = typeof this.gl.getContextAttributes === 'function'
      ? this.gl.getContextAttributes()
      : null;
    if (attrs && attrs.stencil === false) {
      throw new Error(
        'WeaselRenderer: the supplied WebGL2 context has no stencil buffer. '
        + 'Create it with { stencil: true } — clips and even-odd fills need one.',
      );
    }

    this.widthCss = opts.width;
    this.heightCss = opts.height;
    this.dpr = opts.dpr;
    this.imageMinification = opts.imageMinification ?? 'linear';
    this.flattenTolerance = opts.flattenTolerance;
    this.bakeBudget = opts.bakeBudget ?? DEFAULT_BAKE_BUDGET;
    this.textOutlineMinScreenSize = opts.textOutlineMinScreenSize ?? OUTLINE_MIN_SCREEN_PX;

    this.canvas = opts.canvas ?? null;
    if (this.canvas) {
      this.canvas.width = Math.round(opts.width * opts.dpr);
      this.canvas.height = Math.round(opts.height * opts.dpr);
      if (this.canvas.style) {
        this.canvas.style.width = `${opts.width}px`;
        this.canvas.style.height = `${opts.height}px`;
      }
      this.canvas.addEventListener('webglcontextlost', this.boundOnLost);
      this.canvas.addEventListener('webglcontextrestored', this.boundOnRestored);
    }

    this.applyGlState();
    this.applyTarget();

    this.pathFill = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
    this.pathFill.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFill.lookupAttributes(PATH_FILL_ATTRIBUTES);

    this.pathFillVColor = new ShaderProgram(this.gl, VCOLOR_VERT_SRC, VCOLOR_FRAG_SRC);
    this.pathFillVColor.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFillVColor.lookupAttributes(PATH_FILL_VCOLOR_ATTRIBUTES);

    this.textSdf = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_SRC);
    this.textSdf.lookupUniforms(TEXT_SDF_UNIFORMS);
    this.textSdf.lookupAttributes(TEXT_SDF_ATTRIBUTES);

    this.textSdfR8 = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_R8_SRC);
    this.textSdfR8.lookupUniforms(TEXT_SDF_UNIFORMS);
    this.textSdfR8.lookupAttributes(TEXT_SDF_ATTRIBUTES);

    this.imageFill = new ShaderProgram(this.gl, IMAGE_VERT_SRC, IMAGE_FRAG_SRC);
    this.imageFill.lookupUniforms(IMAGE_FILL_UNIFORMS);
    this.imageFill.lookupAttributes(IMAGE_FILL_ATTRIBUTES);

    this.gradFill = new ShaderProgram(this.gl, GRAD_VERT_SRC, GRAD_FRAG_SRC);
    this.gradFill.lookupUniforms(GRAD_FILL_UNIFORMS);
    this.gradFill.lookupAttributes(GRAD_FILL_ATTRIBUTES);

    this.patternFill = new ShaderProgram(this.gl, PATTERN_VERT_SRC, PATTERN_FRAG_SRC);
    this.patternFill.lookupUniforms(PATTERN_FILL_UNIFORMS);
    this.patternFill.lookupAttributes(PATTERN_FILL_ATTRIBUTES);

    const aPos = this.pathFill.attribute('a_position');
    if (aPos === undefined) throw new Error('WeaselRenderer: a_position not found in path-fill shader');
    this.meshCache = new GLMeshCache(this.gl, aPos);
    this.textureCache = new GLTextureCache(this.gl);
    this.imageCache = new GLImageCache(this.gl, this.imageMinification);
    this.gradRampCache = new GradientRampCache(this.gl);
    this.uploadQuadGeometry();
    this.solidBatch = new SolidBatch(this.gl, this.pathFillVColor);
  }

  private uploadQuadGeometry(): void {
    const gl = this.gl;
    this.quadVbo = gl.createBuffer();
    this.quadIbo = gl.createBuffer();
    if (!this.quadVbo || !this.quadIbo) {
      throw new Error('WeaselRenderer: failed to create quad geometry buffers');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  /**
   * Compile a consumer-registered shader program against this renderer's GL context.
   *
   * Call once per renderer after the module-level `registerProgram()`.
   * Throws `ShaderCompileError` if compilation fails.
   *
   * In dev mode, calling again with the same handle replaces the compiled program.
   *
   * @experimental
   */
  registerProgram(handle: ShaderProgramHandle): void {
    // A disposed renderer must not compile programs into the cleared registry.
    if (this.disposed) return;
    const src = getProgramSource(handle.id);
    if (!src) {
      throw new Error(
        `WeaselRenderer.registerProgram: program "${handle.id}" not found in source registry. ` +
        `Call the module-level registerProgram() first.`,
      );
    }
    const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
    const fragSrc = src.frag;
    const program = new ShaderProgram(this.gl, vertSrc, fragSrc);
    program.lookupUniforms([...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(fragSrc)]);
    program.lookupAttributes(CUSTOM_ATTRIBUTES);
    const previous = this.programRegistry.get(handle.id);
    if (previous) this.gl.deleteProgram(previous.handle);
    this.programRegistry.set(handle.id, program);
  }

  /**
   * The compiled program for `id`, compiling it against this context on first
   * use. Unlike {@link registerProgram} this neither throws on a missing
   * source nor on a compile failure: a paint kind asking for a program it
   * never registered must decline the paint, not take down the frame.
   */
  private ensureProgram(id: string): ShaderProgram | null {
    const existing = this.programRegistry.get(id);
    if (existing) return existing;
    if (this.disposed || !getProgramSource(id)) return null;
    try {
      this.registerProgram({ id });
    } catch (e) {
      console.error(`weasel: failed to compile paint program "${id}":`, e);
      return null;
    }
    return this.programRegistry.get(id) ?? null;
  }

  /** The GL state every frame assumes. Applied per `render()` rather than once
   *  at construction because a co-tenant sharing this context moves all of it
   *  between our frames. */
  private applyGlState(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
  }

  /** Viewport and scissor for this frame. Re-applied inside `render()` because
   *  a co-tenant on the same context moves both between our frames. */
  private applyTarget(): void {
    const gl = this.gl;
    const w = Math.round(this.widthCss * this.dpr);
    const h = Math.round(this.heightCss * this.dpr);
    if (!this.target) {
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, w, h);
      return;
    }
    const x = Math.round(this.target.origin.x * this.dpr);
    const y = gl.drawingBufferHeight - Math.round(this.target.origin.y * this.dpr) - h;
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h);
    gl.enable(gl.SCISSOR_TEST);
  }

  /** Confine this renderer to a rect of its drawing buffer, or pass null to
   *  give it the whole buffer back. Takes effect from the next `render()`. */
  setTarget(target: RenderTarget | null): void {
    this.target = target;
    this.applyTarget();
  }

  getTarget(): RenderTarget | null {
    return this.target;
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  private onContextLost(e: Event): void {
    e.preventDefault();
    this.contextLost = true;
  }

  private onContextRestored(): void {
    this.contextLost = false;
    this.applyGlState();
    this.applyTarget();
    this.pathFill = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
    this.pathFill.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFill.lookupAttributes(PATH_FILL_ATTRIBUTES);
    this.pathFillVColor = new ShaderProgram(this.gl, VCOLOR_VERT_SRC, VCOLOR_FRAG_SRC);
    this.pathFillVColor.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFillVColor.lookupAttributes(PATH_FILL_VCOLOR_ATTRIBUTES);
    this.textSdf = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_SRC);
    this.textSdf.lookupUniforms(TEXT_SDF_UNIFORMS);
    this.textSdf.lookupAttributes(TEXT_SDF_ATTRIBUTES);
    this.textSdfR8 = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_R8_SRC);
    this.textSdfR8.lookupUniforms(TEXT_SDF_UNIFORMS);
    this.textSdfR8.lookupAttributes(TEXT_SDF_ATTRIBUTES);
    this.imageFill = new ShaderProgram(this.gl, IMAGE_VERT_SRC, IMAGE_FRAG_SRC);
    this.imageFill.lookupUniforms(IMAGE_FILL_UNIFORMS);
    this.imageFill.lookupAttributes(IMAGE_FILL_ATTRIBUTES);
    this.gradFill = new ShaderProgram(this.gl, GRAD_VERT_SRC, GRAD_FRAG_SRC);
    this.gradFill.lookupUniforms(GRAD_FILL_UNIFORMS);
    this.gradFill.lookupAttributes(GRAD_FILL_ATTRIBUTES);

    this.patternFill = new ShaderProgram(this.gl, PATTERN_VERT_SRC, PATTERN_FRAG_SRC);
    this.patternFill.lookupUniforms(PATTERN_FILL_UNIFORMS);
    this.patternFill.lookupAttributes(PATTERN_FILL_ATTRIBUTES);
    const aPos = this.pathFill.attribute('a_position');
    if (aPos === undefined) throw new Error('a_position missing after restore');
    this.meshCache = new GLMeshCache(this.gl, aPos);
    this.textureCache = new GLTextureCache(this.gl);
    this.imageCache = new GLImageCache(this.gl, this.imageMinification);
    this.gradRampCache = new GradientRampCache(this.gl);
    markAllFontsNotUploaded();

    this.uploadQuadGeometry();
    this.solidBatch = new SolidBatch(this.gl, this.pathFillVColor);
    for (const id of this.programRegistry.keys()) {
      const src = getProgramSource(id);
      if (!src) continue;
      const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
      try {
        const program = new ShaderProgram(this.gl, vertSrc, src.frag);
        program.lookupUniforms([...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(src.frag)]);
        program.lookupAttributes(CUSTOM_ATTRIBUTES);
        this.programRegistry.set(id, program);
      } catch (e) {
        console.error(`weasel: failed to recompile program "${id}" after context restore:`, e);
      }
    }
  }

  /** Free the GL resources this renderer itself owns and detach context-loss
   *  listeners when a canvas was supplied. Idempotent.
   *
   *  Scope: built-in shader programs, any consumer-registered programs, the
   *  shared quad/rect geometry, any in-flight transient meshes, and the
   *  enumerable Map-keyed caches (`GLTextureCache` atlas/image textures,
   *  `GradientRampCache` ramp textures) ARE freed.
   *
   *  NOT freed: `GLImageCache` (bitmap/pattern textures) and `GLMeshCache`'s
   *  persistent per-Path mesh cache are keyed by `WeakMap`, not enumerable,
   *  and are only reclaimed when the GL context itself goes away (cf.
   *  `GLImageCache`'s own "deferred to v2" note). On a caller-owned
   *  long-lived context — the headless render-to-pixels path hands the same
   *  `gl` to many short-lived renderers — the image/pattern textures and
   *  persistent Path meshes each renderer uploads DO accumulate across
   *  renderer instances until the caller recycles the context.
   *
   *  Also: a Mesh that gets GC'd after `dispose()` still lands in
   *  `GLMeshCache`'s `pendingDeletes` queue via its `FinalizationRegistry`,
   *  but nothing drains that queue post-dispose (only `render()` does) —
   *  those GL resources leak until the context goes away too.
   *
   *  A disposed renderer ignores further `render()` and `registerProgram()`
   *  calls. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.boundOnLost);
      this.canvas.removeEventListener('webglcontextrestored', this.boundOnRestored);
    }
    this.meshCache.freeTransient();
    this.meshCache.drainPendingDeletes();
    for (const prog of [this.pathFill, this.pathFillVColor, this.textSdf, this.textSdfR8, this.imageFill, this.gradFill, this.patternFill]) {
      gl.deleteProgram(prog.handle);
    }
    for (const prog of this.programRegistry.values()) {
      gl.deleteProgram(prog.handle);
    }
    this.programRegistry.clear();
    this.textureCache.free();
    this.gradRampCache.free();
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.quadIbo) gl.deleteBuffer(this.quadIbo);
    disposeImageQuads(gl, this.imageFill);
    for (const prog of [this.textSdf, this.textSdfR8, this.pathFill]) disposeTextQuads(gl, prog);
    this.solidBatch.dispose();
  }

  /**
   * Draw one frame.
   *
   * `viewMatrix` is the frame's world→screen transform. It is only consulted
   * by `units: 'world'` gradients, which fall back to screen space without
   * it — every other command carries its own transform in the stream, so
   * callers with no view concept can keep calling `render(commands)`.
   */
  render(commands: DrawCommand[], viewMatrix?: Mat3): void {
    if (this.contextLost || this.disposed) return;
    const gl = this.gl;
    // Free GL resources whose Mesh was GC'd since the last frame. Done here
    // (top of render, before any draws) because GL state is known clean —
    // no VAO bound, no draw in flight. Deleting from the FinalizationRegistry
    // callback directly was racy and caused mid-draw crashes.
    this.meshCache.drainPendingDeletes();
    // New frame: refill the dynamic-glyph synchronous bake budget.
    resetBakeBudget(this.bakeBudget);
    this.groupState.reset();
    this.applyGlState();
    this.applyTarget();
    // Ensure all stencil bits are cleared regardless of any mask left over
    // from the previous frame's clip ops.
    gl.stencilMask(0xFF);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const ctx: DrawContext = {
      gl,
      pathFill: this.pathFill,
      pathFillVColor: this.pathFillVColor,
      textSdf: this.textSdf,
      textSdfR8: this.textSdfR8,
      imageFill: this.imageFill,
      gradFill: this.gradFill,
      patternFill: this.patternFill,
      meshCache: this.meshCache,
      textureCache: this.textureCache,
      imageCache: this.imageCache,
      gradRampCache: this.gradRampCache,
      programRegistry: this.programRegistry,
      ensureProgram: (id) => this.ensureProgram(id),
      quadVbo: this.quadVbo,
      quadIbo: this.quadIbo,
      solidBatch: this.solidBatch,
      state: this.groupState,
      widthCss: this.widthCss,
      heightCss: this.heightCss,
      clipDepth: 0,
      flattenTolerance: this.flattenTolerance,
      textOutlineMinScreenSize: this.textOutlineMinScreenSize,
      viewMatrix,
    };
    for (const cmd of commands) dispatch(ctx, cmd);
    // The stream ended, so whatever rects are still staged have nothing left
    // that could merge with them.
    flushSolids(ctx);
    // Free transient resources allocated during this frame (e.g. per-frame
    // stroke ribbons from tessellateStroke). Done after all draws complete
    // so we never delete a buffer that's still bound to a pending draw.
    this.meshCache.freeTransient();
  }

  resize(dims: { width: number; height: number; dpr: number }): void {
    this.widthCss = dims.width;
    this.heightCss = dims.height;
    this.dpr = dims.dpr;
    if (this.canvas) {
      this.canvas.width = Math.round(dims.width * dims.dpr);
      this.canvas.height = Math.round(dims.height * dims.dpr);
      if (this.canvas.style) {
        this.canvas.style.width = `${dims.width}px`;
        this.canvas.style.height = `${dims.height}px`;
      }
    }
    this.applyTarget();
  }

  /** @internal */ _gl(): WebGL2RenderingContext { return this.gl; }
  /** @internal */ _pathFill(): ShaderProgram { return this.pathFill; }
  /** @internal */ _pathFillVColor(): ShaderProgram { return this.pathFillVColor; }
  /** @internal */ _solidBatch(): SolidBatch { return this.solidBatch; }
  /** @internal */ _textSdf(): ShaderProgram { return this.textSdf; }
  /** @internal */ _textSdfR8(): ShaderProgram { return this.textSdfR8; }
  /** @internal */ _imageFill(): ShaderProgram { return this.imageFill; }
  /** @internal */ _gradFill(): ShaderProgram { return this.gradFill; }
  /** @internal */ _patternFill(): ShaderProgram { return this.patternFill; }
  /** @internal */ _meshCache(): GLMeshCache { return this.meshCache; }
  /** @internal */ _textureCache(): GLTextureCache { return this.textureCache; }
  /** @internal */ _imageCache(): GLImageCache { return this.imageCache; }
  /** @internal */ _gradRampCache(): GradientRampCache { return this.gradRampCache; }
  /** @internal */ _groupState(): GroupState { return this.groupState; }
  /** @internal */ _widthCss(): number { return this.widthCss; }
  /** @internal */ _heightCss(): number { return this.heightCss; }
  /** @internal */ _dpr(): number { return this.dpr; }
}
