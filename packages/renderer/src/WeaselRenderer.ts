import { createPaintResources, type OwnedPaintResources } from './paintResources';
import { ShaderProgram } from './shaders/ShaderProgram';
import {
  LazyProgram, PATH_FILL_SPEC, PATH_FILL_VCOLOR_SPEC, GRAD_FILL_SPEC, PATTERN_FILL_SPEC,
  BATCH_FILL_MATRICES_SPEC, createBatchFill,
} from './shaders/builtinPrograms';
import {
  markAllFontsNotUploaded,
  resetBakeBudget,
  DEFAULT_BAKE_BUDGET,
} from '@weasel-js/font';
import {
  GLYPH_PAINT_VERT_SRC,
  GLYPH_PATTERN_FRAG_SRC,
  GLYPH_GRAD_FRAG_SRC,
  GLYPH_TEXTURE_FRAG_SRC,
  GLYPH_PATTERN_UNIFORMS,
  GLYPH_GRAD_UNIFORMS,
  GLYPH_TEXTURE_UNIFORMS,
  GLYPH_PAINT_ATTRIBUTES,
} from './shaders/glyphPaint';
import { PaintScratch } from './paintScratch';
import { GLMeshCache } from './cache/GLMeshCache';
import { GLTextureCache } from './cache/GLTextureCache';
import { textureRegistry } from './textures/registerTexture';
import { GLImageCache, type ImageMinification } from './cache/GLImageCache';
import { GradientRampAtlas } from './cache/GradientRampAtlas';
import { GroupState } from './state/GroupState';
import type { DrawCommand } from './DrawCommand';
import { inCssPixels, type FlattenTolerance } from './draw/flattenTolerance';
import type { GlMat3 } from '@weasel-js/geom';
import {
  dispatch, flushBatch, OUTLINE_MIN_SCREEN_PX, type DrawContext, type GlyphPaintKind,
} from './draw';
import { DrawBatch } from './drawBatch';
import {
  CUSTOM_VERT_SRC, CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS,
  QUAD_VERTICES, QUAD_INDICES,
} from './shaders/customPrelude';
import { getProgramSource, type ProgramSource, type ShaderProgramHandle } from './shaders/registerProgram';
import { EffectTargets } from './effects/EffectTargets';
import { extractUniformArrays, extractUniformNames } from './shaders/extractUniformNames';

/** Every uniform a custom program may be written through. Both stages, not
 *  just the fragment one: a name never looked up is written through `null`,
 *  which GL accepts silently, so the uniform keeps its zero default. */
function customUniformNames(vertSrc: string, fragSrc: string): string[] {
  return [...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(vertSrc), ...extractUniformNames(fragSrc)];
}

/** Compile a registered program's source against `gl`, with every uniform
 *  location and array base it may be written through. */
function compileCustomProgram(gl: WebGL2RenderingContext, src: ProgramSource): ShaderProgram {
  const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
  const program = new ShaderProgram(gl, vertSrc, src.frag);
  program.lookupUniforms(customUniformNames(vertSrc, src.frag));
  program.lookupUniformArrays(new Map([...extractUniformArrays(vertSrc), ...extractUniformArrays(src.frag)]));
  program.lookupAttributes(CUSTOM_ATTRIBUTES);
  return program;
}

/** A run of top-level commands, `[start, end)` by index, that
 *  {@link WeaselRenderer.lastFrameStats} accounts for separately — one render
 *  layer's commands, say. Spans are in order and do not overlap. */
export interface RenderSpan {
  id: string;
  start: number;
  end: number;
}

/** Per-frame options for {@link WeaselRenderer.render}. */
export interface RenderOptions {
  spans?: readonly RenderSpan[];
}

/** What one span cost. A batched run is drawn when something closes it, so
 *  its draw call counts toward the span that closed it. */
export interface RenderSpanStats {
  id: string;
  drawCalls: number;
  ms: number;
}

/** What one `render()` cost. See {@link WeaselRenderer.lastFrameStats}. */
export interface RenderStats {
  drawCalls: number;
  ms: number;
  spans: RenderSpanStats[];
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Construction options for {@link WeaselRenderer}. Pass `gl` or `canvas`;
 *  a context passed in must have a stencil buffer. */
export interface WeaselRendererOptions {
  /** A WebGL2 context to draw with. Wins over `canvas`. */
  gl?: WebGL2RenderingContext;
  /** A canvas to open a stencil-backed WebGL2 context on, when `gl` is absent.
   *  The renderer sets its drawing buffer and never its CSS size. */
  canvas?: HTMLCanvasElement;
  /** Drawing size in CSS pixels. */
  width: number;
  /** Drawing size in CSS pixels. */
  height: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
  /** MIN_FILTER strategy for image textures (`GLImageCache`). Default
   *  `'linear'`. `'mipmap'` builds mipmaps for every image at upload, as
   *  the headless `renderSceneToPixels` path does; `'auto'` builds them
   *  for an image the first time a frame draws it at half size or smaller. */
  imageMinification?: ImageMinification;
  /** How far a flattened curve may stray: in world units, or `{ px }` in
   *  device pixels, which follows each path's transform so a zoom keeps
   *  curves smooth. Default `{ px: DEFAULT_FLATTEN_TOLERANCE_PX }`. */
  flattenTolerance?: FlattenTolerance;
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

/** Each glyph-paint program's fragment stage and the uniforms it looks up. */
const GLYPH_PAINT_SOURCES: Record<GlyphPaintKind, readonly [string, readonly string[]]> = {
  pattern: [GLYPH_PATTERN_FRAG_SRC, GLYPH_PATTERN_UNIFORMS],
  gradient: [GLYPH_GRAD_FRAG_SRC, GLYPH_GRAD_UNIFORMS],
  texture: [GLYPH_TEXTURE_FRAG_SRC, GLYPH_TEXTURE_UNIFORMS],
};

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
  private stats: RenderStats = { drawCalls: 0, ms: 0, spans: [] };
  /** Built on the first frame that draws with each, so a one-shot render of
   *  plain shapes builds the batch program alone. */
  private readonly pathFill: LazyProgram;
  private readonly pathFillVColor: LazyProgram;
  private batchFill: ShaderProgram;
  private readonly batchFillMatrices: LazyProgram;
  private readonly gradFill: LazyProgram;
  private readonly patternFill: LazyProgram;
  /** Compiled on first use: only atlas text under a texture paint needs one. */
  private glyphPaintPrograms = new Map<GlyphPaintKind, ShaderProgram>();
  private meshCache: GLMeshCache;
  private textureCache: GLTextureCache;
  private imageCache: GLImageCache;
  private gradRamps: GradientRampAtlas;
  private programRegistry = new Map<string, ShaderProgram>();
  /** The source each compiled custom program was built from — or, after a
   *  failed recompile, the source that failed, so it is not retried every frame. */
  private programSources = new Map<string, ProgramSource>();
  private quadVbo: WebGLBuffer | null = null;
  private quadIbo: WebGLBuffer | null = null;
  private drawBatch: DrawBatch;
  /** 1x1 white, so a batch flush sampling no image still samples something —
   *  see `shaders/batchFill.ts`. */
  private whiteTexture: WebGLTexture | null = null;
  private readonly groupState = new GroupState();
  private widthCss: number;
  private heightCss: number;
  private dpr: number;
  private canvas: HTMLCanvasElement | null = null;
  /** Where context loss is announced: the context's own canvas, which the
   *  renderer need not own the size of. */
  private lossTarget: EventTarget | null = null;
  private target: RenderTarget | null = null;
  /** Offscreen buffers for group effects. Allocates nothing until a group
   *  with effects asks, so a canvas without them pays no memory. */
  private readonly effectTargets: EffectTargets;
  private readonly paintScratch: PaintScratch;
  private readonly imageMinification: ImageMinification;
  private flattenTolerance?: FlattenTolerance;
  private readonly bakeBudget: number;
  private readonly textOutlineMinScreenSize: number;
  private contextLost = false;
  private boundOnLost = (e: Event) => this.onContextLost(e);
  private boundOnRestored = () => this.onContextRestored();
  /** True after `dispose()`. A disposed renderer ignores further `render()`
   *  calls and `registerProgram()` calls. */
  private disposed = false;
  /** What registered paint kinds hang their GPU state on. One per context
   *  generation: a restore releases it and opens the next. */
  private paintResources: OwnedPaintResources = createPaintResources();

  constructor(opts: WeaselRendererOptions) {
    if (!opts.gl && !opts.canvas) {
      throw new Error('WeaselRenderer requires either gl or canvas');
    }
    const gl = opts.gl ?? opts.canvas!.getContext('webgl2', { stencil: true });
    if (!gl) throw new Error('WeaselRenderer: WebGL2 not available');
    this.gl = gl as WebGL2RenderingContext;
    this.effectTargets = new EffectTargets(this.gl);
    this.paintScratch = new PaintScratch(this.gl);

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
    }
    const lossTarget: Partial<EventTarget> | null = this.canvas ?? this.gl.canvas ?? null;
    if (lossTarget && typeof lossTarget.addEventListener === 'function') {
      this.lossTarget = lossTarget as EventTarget;
      this.lossTarget.addEventListener('webglcontextlost', this.boundOnLost);
      this.lossTarget.addEventListener('webglcontextrestored', this.boundOnRestored);
    }

    this.applyGlState();
    this.applyTarget();

    this.pathFill = new LazyProgram(this.gl, PATH_FILL_SPEC);
    this.pathFillVColor = new LazyProgram(this.gl, PATH_FILL_VCOLOR_SPEC);
    this.gradFill = new LazyProgram(this.gl, GRAD_FILL_SPEC);
    this.patternFill = new LazyProgram(this.gl, PATTERN_FILL_SPEC);
    this.batchFillMatrices = new LazyProgram(this.gl, BATCH_FILL_MATRICES_SPEC);
    this.batchFill = createBatchFill(this.gl);

    this.meshCache = new GLMeshCache(this.gl);
    this.textureCache = new GLTextureCache(this.gl);
    this.imageCache = new GLImageCache(this.gl, this.imageMinification);
    this.gradRamps = new GradientRampAtlas(this.gl);
    this.uploadQuadGeometry();
    this.drawBatch = new DrawBatch(this.gl, this.batchFill);
    this.whiteTexture = createWhiteTexture(this.gl);
  }

  private lazyPrograms(): LazyProgram[] {
    return [this.pathFill, this.pathFillVColor, this.gradFill, this.patternFill, this.batchFillMatrices];
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
   * Optional: a program compiles on the first frame that draws with it. Call
   * this after the module-level `registerProgram()` to pay for the compile
   * before that frame, or to catch the `ShaderCompileError` it throws.
   *
   * In dev mode, calling again with the same handle replaces the compiled program.
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
    this.installProgram(handle.id, src, compileCustomProgram(this.gl, src));
  }

  private installProgram(id: string, src: ProgramSource, program: ShaderProgram): void {
    const previous = this.programRegistry.get(id);
    if (previous) this.gl.deleteProgram(previous.handle);
    this.programRegistry.set(id, program);
    this.programSources.set(id, src);
  }

  /** Recompile every program whose module-level source was re-registered
   *  since it was compiled. A source that fails keeps the old program drawing. */
  private refreshPrograms(): void {
    for (const [id, compiled] of this.programSources) {
      const src = getProgramSource(id);
      if (!src || src === compiled) continue;
      if (src.vert === compiled.vert && src.frag === compiled.frag) {
        this.programSources.set(id, src);
        continue;
      }
      try {
        this.installProgram(id, src, compileCustomProgram(this.gl, src));
      } catch (e) {
        this.programSources.set(id, src);
        console.error(`weasel: failed to recompile re-registered program "${id}"; still drawing the previous one:`, e);
      }
    }
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

  private glyphPaintProgram(kind: GlyphPaintKind): ShaderProgram {
    const existing = this.glyphPaintPrograms.get(kind);
    if (existing) return existing;
    const [frag, uniforms] = GLYPH_PAINT_SOURCES[kind];
    const program = new ShaderProgram(this.gl, GLYPH_PAINT_VERT_SRC, frag);
    program.lookupUniforms(uniforms);
    program.lookupAttributes(GLYPH_PAINT_ATTRIBUTES);
    this.glyphPaintPrograms.set(kind, program);
    return program;
  }

  /** The blend, depth, cull, clear-color, color-mask, VAO, and unpack-flip
   *  state every frame assumes.
   *  Applied per `render()` rather than once at construction because a
   *  co-tenant sharing this context moves all of it between our frames. */
  private applyGlState(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true);
    gl.bindVertexArray(null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /** This renderer's rect in device pixels, top-left origin. A tile rounds its
   *  edges rather than its size, so two that share a CSS edge share a device one. */
  private deviceRect(): { x: number; y: number; width: number; height: number } {
    const ox = this.target?.origin.x ?? 0;
    const oy = this.target?.origin.y ?? 0;
    const x = Math.round(ox * this.dpr);
    const y = Math.round(oy * this.dpr);
    return {
      x,
      y,
      width: Math.round((ox + this.widthCss) * this.dpr) - x,
      height: Math.round((oy + this.heightCss) * this.dpr) - y,
    };
  }

  /** Viewport and scissor for this frame. Re-applied inside `render()` because
   *  a co-tenant on the same context moves both between our frames. */
  private applyTarget(): void {
    const gl = this.gl;
    const { x, y, width, height } = this.deviceRect();
    if (!this.target) {
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, width, height);
      return;
    }
    const glY = gl.drawingBufferHeight - y - height;
    gl.viewport(x, glY, width, height);
    gl.scissor(x, glY, width, height);
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
    // Every framebuffer, texture and renderbuffer the pool held died with the
    // context. `releaseAll` deletes handles that are already gone, which is a
    // no-op, and drops the bookkeeping that would otherwise hand a dead FBO to
    // the next group with effects.
    this.effectTargets.releaseAll();
    this.paintScratch.release();
    this.paintResources.release();
    this.paintResources = createPaintResources();
    for (const lazy of this.lazyPrograms()) lazy.abandon();
    this.batchFill = createBatchFill(this.gl);
    this.glyphPaintPrograms.clear();
    this.meshCache = new GLMeshCache(this.gl);
    this.textureCache = new GLTextureCache(this.gl);
    this.imageCache.abandon();
    this.imageCache = new GLImageCache(this.gl, this.imageMinification);
    this.gradRamps = new GradientRampAtlas(this.gl);
    markAllFontsNotUploaded();

    this.uploadQuadGeometry();
    this.drawBatch = new DrawBatch(this.gl, this.batchFill);
    this.whiteTexture = createWhiteTexture(this.gl);
    for (const id of this.programRegistry.keys()) {
      const src = getProgramSource(id);
      if (!src) continue;
      try {
        this.programRegistry.set(id, compileCustomProgram(this.gl, src));
        this.programSources.set(id, src);
      } catch (e) {
        console.error(`weasel: failed to recompile program "${id}" after context restore:`, e);
      }
    }
  }

  /** Free every GL resource this renderer created and detach its
   *  context-loss listeners. Idempotent. The context itself is left alone, so
   *  a caller-owned context can host renderer after renderer without
   *  accumulating anything.
   *
   *  A disposed renderer ignores further `render()` and `registerProgram()`
   *  calls. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    if (this.lossTarget) {
      this.lossTarget.removeEventListener('webglcontextlost', this.boundOnLost);
      this.lossTarget.removeEventListener('webglcontextrestored', this.boundOnRestored);
    }
    this.meshCache.dispose();
    this.paintResources.release();
    for (const lazy of this.lazyPrograms()) lazy.release();
    for (const prog of [this.batchFill, ...this.glyphPaintPrograms.values()]) {
      gl.deleteProgram(prog.handle);
    }
    this.glyphPaintPrograms.clear();
    for (const prog of this.programRegistry.values()) {
      gl.deleteProgram(prog.handle);
    }
    this.programRegistry.clear();
    this.programSources.clear();
    this.textureCache.free();
    this.imageCache.dispose();
    this.gradRamps.free();
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.quadIbo) gl.deleteBuffer(this.quadIbo);
    this.drawBatch.dispose();
    if (this.whiteTexture) gl.deleteTexture(this.whiteTexture);
    this.whiteTexture = null;
    this.effectTargets.releaseAll();
    this.paintScratch.release();
  }

  /**
   * Draw one frame.
   *
   * `viewMatrix` is the frame's world→screen transform. It is only consulted
   * by `units: 'world'` gradients, which fall back to screen space without
   * it — every other command carries its own transform in the stream, so
   * callers with no view concept can keep calling `render(commands)`.
   */
  render(commands: DrawCommand[], viewMatrix?: GlMat3, opts?: RenderOptions): void {
    if (this.contextLost || this.disposed) return;
    const t0 = now();
    const counters = { drawCalls: 0 };
    const spanStats: RenderSpanStats[] = [];
    this.stats = { drawCalls: 0, ms: 0, spans: spanStats };
    const gl = this.gl;
    // Free GL resources whose Mesh was GC'd since the last frame. Done here,
    // before any draws, because GL state is known clean — deleting from the
    // FinalizationRegistry callback directly races a draw in flight.
    this.meshCache.drainPendingDeletes();
    this.imageCache.beginFrame();
    this.textureCache.sweep(textureRegistry);
    this.refreshPrograms();
    // New frame: refill the dynamic-glyph synchronous bake budget.
    resetBakeBudget(this.bakeBudget);
    // A frame that threw part-way never unwound: its group stack, its staged
    // vertices, the effect buffer it was drawing into, and whichever
    // offscreen buffer it had bound are all still here.
    this.groupState.reset();
    this.drawBatch.reset();
    this.effectTargets.reclaim();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.applyGlState();
    this.applyTarget();
    // Ensure all stencil bits are cleared regardless of any mask left over
    // from the previous frame's clip ops.
    if (this.target?.clear !== false) {
      gl.stencilMask(0xFF);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    }
    const device = this.deviceRect();
    const { pathFill, pathFillVColor, gradFill, patternFill, batchFillMatrices } = this;
    const ctx: DrawContext = {
      gl,
      get pathFill() { return pathFill.get(); },
      get pathFillVColor() { return pathFillVColor.get(); },
      batchFill: this.batchFill,
      get batchFillMatrices() { return batchFillMatrices.get(); },
      get gradFill() { return gradFill.get(); },
      get patternFill() { return patternFill.get(); },
      meshCache: this.meshCache,
      textureCache: this.textureCache,
      imageCache: this.imageCache,
      gradRamps: this.gradRamps,
      programRegistry: this.programRegistry,
      ensureProgram: (id) => this.ensureProgram(id),
      glyphPaintProgram: (kind) => this.glyphPaintProgram(kind),
      quadVbo: this.quadVbo,
      quadIbo: this.quadIbo,
      drawBatch: this.drawBatch,
      whiteTexture: this.whiteTexture,
      state: this.groupState,
      widthCss: this.widthCss,
      heightCss: this.heightCss,
      clipDepth: 0,
      clipStack: [],
      flattenTolerance: inCssPixels(this.flattenTolerance, this.dpr),
      textOutlineMinScreenSize: this.textOutlineMinScreenSize,
      viewMatrix,
      effectTargets: this.effectTargets,
      paintScratch: this.paintScratch,
      renderTarget: null,
      deviceWidth: device.width,
      deviceHeight: device.height,
      restoreTargetRect: () => this.applyTarget(),
      paintResources: this.paintResources,
      stats: counters,
    };
    // A frame that threw part-way left its clip here.
    this.drawBatch.clip = null;
    const spans = opts?.spans ?? [];
    let next = 0;
    for (let si = 0; si < spans.length; si++) {
      const span = spans[si];
      for (; next < span.start; next++) dispatch(ctx, commands[next]);
      const drawsBefore = counters.drawCalls;
      const spanT0 = now();
      for (; next < span.end; next++) dispatch(ctx, commands[next]);
      // The stream's closing flush belongs to whatever it closes.
      if (si === spans.length - 1 && next >= commands.length) flushBatch(ctx);
      spanStats.push({ id: span.id, drawCalls: counters.drawCalls - drawsBefore, ms: now() - spanT0 });
    }
    for (; next < commands.length; next++) dispatch(ctx, commands[next]);
    // The stream ended, so whatever is still staged has nothing left that
    // could merge with it.
    flushBatch(ctx);
    // Free transient resources allocated during this frame (e.g. per-frame
    // stroke ribbons from tessellateStroke). Done after all draws complete
    // so we never delete a buffer that's still bound to a pending draw.
    this.meshCache.freeTransient();
    this.stats.drawCalls = counters.drawCalls;
    this.stats.ms = now() - t0;
  }

  /** What the last `render()` cost: GL draw calls issued and CPU milliseconds
   *  spent issuing them, in total and per requested span. GPU time is not
   *  measured; the GPU runs asynchronously. */
  lastFrameStats(): RenderStats {
    return this.stats;
  }

  /** Change `flattenTolerance` after construction; `undefined` restores the default. */
  setFlattenTolerance(tolerance: FlattenTolerance | undefined): void {
    this.flattenTolerance = tolerance;
  }

  resize(dims: { width: number; height: number; dpr: number }): void {
    this.widthCss = dims.width;
    this.heightCss = dims.height;
    this.dpr = dims.dpr;
    if (this.canvas) {
      this.canvas.width = Math.round(dims.width * dims.dpr);
      this.canvas.height = Math.round(dims.height * dims.dpr);
    }
    this.applyTarget();
  }

  /** @internal */ _gl(): WebGL2RenderingContext { return this.gl; }
  /** @internal */ _pathFill(): ShaderProgram { return this.pathFill.get(); }
  /** @internal */ _pathFillVColor(): ShaderProgram { return this.pathFillVColor.get(); }
  /** @internal */ _drawBatch(): DrawBatch { return this.drawBatch; }
  /** @internal */ _batchFill(): ShaderProgram { return this.batchFill; }
  /** @internal */ _batchFillMatrices(): ShaderProgram { return this.batchFillMatrices.get(); }
  /** @internal */ _gradFill(): ShaderProgram { return this.gradFill.get(); }
  /** @internal */ _patternFill(): ShaderProgram { return this.patternFill.get(); }
  /** @internal */ _meshCache(): GLMeshCache { return this.meshCache; }
  /** @internal */ _textureCache(): GLTextureCache { return this.textureCache; }
  /** @internal */ _imageCache(): GLImageCache { return this.imageCache; }
  /** @internal */ _gradRamps(): GradientRampAtlas { return this.gradRamps; }
  /** @internal */ _groupState(): GroupState { return this.groupState; }
  /** @internal */ _widthCss(): number { return this.widthCss; }
  /** @internal */ _heightCss(): number { return this.heightCss; }
  /** @internal */ _dpr(): number { return this.dpr; }
}

/** The 1x1 opaque white texture a batch flush binds when its run samples no
 *  image. NEAREST both ways: one texel, so there is nothing to filter, and a
 *  mipmap filter on a texture with no mipmaps is incomplete. */
function createWhiteTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}
