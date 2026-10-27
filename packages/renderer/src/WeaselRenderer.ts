import { createPaintResources, type OwnedPaintResources } from './paintResources';
import { ShaderProgram } from './shaders/ShaderProgram';
import {
  LazyProgram, PATH_FILL_SPEC, PATH_FILL_VCOLOR_SPEC, GRAD_FILL_SPEC, PATTERN_FILL_SPEC,
  BATCH_FILL_MATRICES_SPEC, createBatchFill,
} from './shaders/builtinPrograms';
import {
  glyphGeneration,
  markAllFontsNotUploaded,
  resetBakeBudget,
  DEFAULT_BAKE_BUDGET,
} from '@weasel-js/font';
import {
  GLYPH_PAINT_VERT_SRC, GLYPH_PATTERN_FRAG_SRC, GLYPH_GRAD_FRAG_SRC, GLYPH_TEXTURE_FRAG_SRC,
  GLYPH_PATTERN_UNIFORMS, GLYPH_GRAD_UNIFORMS, GLYPH_TEXTURE_UNIFORMS, GLYPH_PAINT_ATTRIBUTES,
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
import { RetainedSurfaces } from './retain/RetainedSurfaces';
import { createWhiteTexture } from './cache/whiteTexture';
import { paintDrawKindRegistry } from './paintKinds';
import {
  DEFAULT_RETAIN_BUDGET, type RenderOptions, type RenderSpanStats, type RenderStats,
  type RenderTarget, type WeaselRendererOptions,
} from './rendererTypes';

export {
  DEFAULT_RETAIN_BUDGET, type RenderOptions, type RenderSpan, type RenderSpanStats, type RenderStats,
  type RenderTarget, type RetainedStats, type WeaselRendererOptions,
} from './rendererTypes';
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

const NO_RETAINED = { composited: 0, redrawn: 0, declined: 0, bytes: 0 } as const;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
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
  private stats: RenderStats = { drawCalls: 0, ms: 0, spans: [], retained: NO_RETAINED };
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
  private readonly retained: RetainedSurfaces;
  /** Advanced when a program is compiled again over one already drawn with,
   *  which leaves every retained surface drawn by the old one stale. */
  private programEpoch = 0;
  private readonly paintScratch: PaintScratch;
  private imageMinification: ImageMinification;
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
    this.retained = new RetainedSurfaces(this.gl, opts.retainBudget ?? DEFAULT_RETAIN_BUDGET);
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
      throw new Error(`WeaselRenderer.registerProgram: program "${handle.id}" not found in source registry. `
        + 'Call the module-level registerProgram() first.');
    }
    this.installProgram(handle.id, src, compileCustomProgram(this.gl, src));
  }

  private installProgram(id: string, src: ProgramSource, program: ShaderProgram): void {
    const previous = this.programRegistry.get(id);
    if (previous) {
      this.gl.deleteProgram(previous.handle);
      this.programEpoch++;
    }
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
    const width = Math.round((ox + this.widthCss) * this.dpr) - x;
    return { x, y, width, height: Math.round((oy + this.heightCss) * this.dpr) - y };
  }

  /** Viewport and scissor for this frame. Re-applied inside `render()` because
   *  a co-tenant on the same context moves both between our frames. */
  private applyTarget(): void {
    const gl = this.gl;
    const { x, y, width, height } = this.glRect();
    gl.viewport(x, y, width, height);
    if (!this.target) {
      gl.disable(gl.SCISSOR_TEST);
      return;
    }
    gl.scissor(x, y, width, height);
    gl.enable(gl.SCISSOR_TEST);
  }

  /** This renderer's rect as GL addresses it, from the buffer's bottom left. */
  private glRect(): { x: number; y: number; width: number; height: number } {
    const { x, y, width, height } = this.deviceRect();
    if (!this.target) return { x: 0, y: 0, width, height };
    return { x, y: this.gl.drawingBufferHeight - y - height, width, height };
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
    this.retained.releaseAll();
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
    for (const prog of [this.batchFill, ...this.glyphPaintPrograms.values()]) gl.deleteProgram(prog.handle);
    this.glyphPaintPrograms.clear();
    for (const prog of this.programRegistry.values()) gl.deleteProgram(prog.handle);
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
    this.retained.releaseAll();
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
    this.stats = { drawCalls: 0, ms: 0, spans: spanStats, retained: NO_RETAINED };
    const gl = this.gl;
    // Free GL resources whose Mesh was GC'd since the last frame. Done here,
    // before any draws, because GL state is known clean — deleting from the
    // FinalizationRegistry callback directly races a draw in flight.
    this.meshCache.drainPendingDeletes();
    this.imageCache.beginFrame();
    this.textureCache.sweep(textureRegistry);
    this.refreshPrograms();
    this.retained.beginFrame([
      glyphGeneration(), textureRegistry.getVersion(), paintDrawKindRegistry.getVersion(),
      this.programEpoch, this.flattenTolerance, this.widthCss, this.heightCss, this.dpr,
    ]);
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
    const own = this.glRect();
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
      viewMatrix, screenMatrix: opts?.screen,
      effectTargets: this.effectTargets,
      retained: this.retained,
      paintScratch: this.paintScratch,
      renderTarget: null,
      fragOrigin: [own.x, own.y],
      deviceWidth: device.width,
      deviceHeight: device.height,
      restoreTargetRect: () => this.applyTarget(),
      viewportWithin: (rect) => gl.viewport(
        own.x + rect.x, own.y + own.height - rect.y - rect.height, rect.width, rect.height),
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
    const retained = this.retained;
    retained.endFrame();
    this.stats.retained = {
      composited: retained.composited, redrawn: retained.redrawn,
      declined: retained.declined, bytes: retained.bytes,
    };
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

  /** Change `retainBudget` after construction; `undefined` restores the default. */
  setRetainBudget(bytes: number | undefined): void {
    this.retained.setBudget(bytes ?? DEFAULT_RETAIN_BUDGET);
  }

  /** Change `imageMinification` after construction; `undefined` restores the
   *  default. A change frees every image texture, and each re-uploads when next drawn. */
  setImageMinification(mode: ImageMinification | undefined): void {
    const next = mode ?? 'linear';
    if (next === this.imageMinification) return;
    this.imageMinification = next;
    this.imageCache.dispose();
    this.imageCache = new GLImageCache(this.gl, next);
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
