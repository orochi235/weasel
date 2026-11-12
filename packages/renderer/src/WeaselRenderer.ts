import { createPaintResources, type OwnedPaintResources } from './paintResources';
import type { ShaderProgram } from './shaders/ShaderProgram';
import type { GpuBuffer, GpuDevice, GpuPassDesc, GpuTexture } from './gpu/types';
import { openWebGL } from './gpu/webgl/openWebGL';
import { openWebGPU } from './gpu/webgpu/openWebGPU';
import {
  LazyProgram, PATH_FILL_SPEC, PATH_FILL_VCOLOR_SPEC, GRAD_FILL_SPEC, PATTERN_FILL_SPEC, GLYPH_PAINT_SPECS,
  BatchVariantPrograms, createBatchFill,
} from './shaders/builtinPrograms';
import { glyphGeneration, markAllFontsNotUploaded, resetBakeBudget, DEFAULT_BAKE_BUDGET } from '@weasel-js/font';
import { textEngineGeneration } from '@weasel-js/text';
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
import { OUTLINE_MIN_SCREEN_PX, type DrawContext, type GlyphPaintKind } from './draw';
import { drawStream, now } from './drawStream';
import { drawIdFrame } from './draw/idRender';
import { readPixels, readPixelsSync, type PixelRect } from './readPixels';
import { createIdComposite } from './draw/idComposite';
import { DrawBatch } from './drawBatch';
import { QUAD_VERTICES, QUAD_INDICES } from './shaders/customPrelude';
import type { ShaderProgramHandle } from './shaders/registerProgram';
import { CustomPrograms } from './shaders/CustomPrograms';
import { EffectTargets } from './effects/EffectTargets';
import { RetainedSurfaces } from './retain/RetainedSurfaces';
import { createWhiteTexture } from './cache/whiteTexture';
import { paintDrawKindRegistry } from './paintKinds';
import {
  DEFAULT_RETAIN_BUDGET, type IdBuffer, type RenderIdsOptions, type RenderOptions, type RenderSpanStats,
  type RenderStats, type RenderTarget, type RendererBackend, type WeaselRendererOptions,
} from './rendererTypes';

const NO_RETAINED = { composited: 0, redrawn: 0, declined: 0, bytes: 0 } as const;

/**
 * The renderer: takes a list of draw commands and paints them, through the
 * GPU layer (`gpu/`) over WebGL 2 or WebGPU.
 *
 * It knows nothing about the scene — commands are the whole interface, which
 * is what lets layers, HUD widgets and overlays all draw through the same
 * pipeline. GPU resources (meshes, textures, gradient ramps) are cached across
 * frames and keyed by identity, so re-issuing the same command is cheap.
 */
export class WeaselRenderer {
  private readonly gpu: GpuDevice;
  private stats: RenderStats = { drawCalls: 0, ms: 0, spans: [], retained: NO_RETAINED };
  /** Built on the first frame that draws with each, so a one-shot render of
   *  plain shapes builds the batch program alone. */
  private readonly pathFill: LazyProgram;
  private readonly pathFillVColor: LazyProgram;
  private batchFill: ShaderProgram;
  private readonly batchVariants: BatchVariantPrograms;
  private readonly gradFill: LazyProgram;
  private readonly patternFill: LazyProgram;
  /** Compiled on first use: only atlas text under a texture paint needs one. */
  private readonly glyphPaintPrograms: Record<GlyphPaintKind, LazyProgram>;
  private meshCache: GLMeshCache;
  private textureCache: GLTextureCache;
  private imageCache: GLImageCache;
  private gradRamps: GradientRampAtlas;
  private readonly programs: CustomPrograms;
  private quad: { vertices: GpuBuffer; indices: GpuBuffer } | null = null;
  private drawBatch: DrawBatch;
  /** 1x1 white, so a batch flush sampling no image still samples something —
   *  see `shaders/batchFill.ts`. */
  private whiteTexture: GpuTexture | null = null;
  private readonly groupState = new GroupState();
  private widthCss: number;
  private heightCss: number;
  private dpr: number;
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  /** Where context loss is announced: the context's own canvas, which the
   *  renderer need not own the size of. */
  private lossTarget: EventTarget | null = null;
  private target: RenderTarget | null = null;
  /** Offscreen buffers for group effects. Allocates nothing until a group
   *  with effects asks, so a canvas without them pays no memory. */
  private readonly effectTargets: EffectTargets;
  private readonly retained: RetainedSurfaces;
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
  /** The program an id frame hands a group's ids back with; built by the first. */
  private idComposite: ShaderProgram | null = null;

  constructor(opts: WeaselRendererOptions) {
    const { device, lossTarget, lost } = opts.gpu ? { ...openWebGPU(opts.gpu), lossTarget: null } : openWebGL(opts);
    this.gpu = device;
    void lost?.then(() => { this.contextLost = true; });
    this.effectTargets = new EffectTargets(this.gpu);
    this.programs = new CustomPrograms(this.gpu);
    this.retained = new RetainedSurfaces(this.gpu, opts.retainBudget ?? DEFAULT_RETAIN_BUDGET);
    this.paintScratch = new PaintScratch(this.gpu);

    // Bits 0-7 are load-bearing: bit 0 for even-odd fills and stenciled
    // strokes, bits 1-7 for clip depth (`renderer/draw.ts`). Without a stencil
    // buffer both render wrong rather than not at all, so refuse the context
    // instead of painting a plausible lie. A stub that cannot answer is not a
    // stencil-less context — only an explicit `false` is.
    if (this.gpu.limits.stencil === false) {
      throw new Error(
        'WeaselRenderer: the supplied WebGL2 context has no stencil buffer. '
        + 'Create it with { stencil: true } — clips and even-odd fills need one.',
      );
    }

    this.widthCss = opts.width;
    this.heightCss = opts.height;
    this.dpr = opts.dpr;
    this.imageMinification = opts.imageMinification ?? 'auto';
    this.flattenTolerance = opts.flattenTolerance;
    this.bakeBudget = opts.bakeBudget ?? DEFAULT_BAKE_BUDGET;
    this.textOutlineMinScreenSize = opts.textOutlineMinScreenSize ?? OUTLINE_MIN_SCREEN_PX;

    this.canvas = opts.gpu?.canvas ?? opts.canvas ?? null;
    if (this.canvas) {
      this.canvas.width = Math.round(opts.width * opts.dpr);
      this.canvas.height = Math.round(opts.height * opts.dpr);
    }
    this.gpu.beginFrame();

    this.pathFill = new LazyProgram(this.gpu, PATH_FILL_SPEC);
    this.pathFillVColor = new LazyProgram(this.gpu, PATH_FILL_VCOLOR_SPEC);
    this.gradFill = new LazyProgram(this.gpu, GRAD_FILL_SPEC);
    this.patternFill = new LazyProgram(this.gpu, PATTERN_FILL_SPEC);
    this.batchVariants = new BatchVariantPrograms(this.gpu);
    this.batchFill = createBatchFill(this.gpu);
    const glyph = (kind: GlyphPaintKind) => new LazyProgram(this.gpu, GLYPH_PAINT_SPECS[kind]);
    this.glyphPaintPrograms = { pattern: glyph('pattern'), gradient: glyph('gradient'), texture: glyph('texture') };

    this.meshCache = new GLMeshCache(this.gpu);
    this.textureCache = new GLTextureCache(this.gpu);
    this.imageCache = new GLImageCache(this.gpu, this.imageMinification);
    this.gradRamps = new GradientRampAtlas(this.gpu);
    this.uploadQuadGeometry();
    this.drawBatch = new DrawBatch(this.gpu, this.batchFill);
    this.whiteTexture = createWhiteTexture(this.gpu);
    // Last: a constructor that throws (a lost context fails the compile above) must leave no listener to rebuild it.
    const events: Partial<EventTarget> | null = opts.gpu ? null : this.canvas ?? lossTarget;
    if (events && typeof events.addEventListener === 'function') {
      this.lossTarget = events as EventTarget;
      this.lossTarget.addEventListener('webglcontextlost', this.boundOnLost);
      this.lossTarget.addEventListener('webglcontextrestored', this.boundOnRestored);
    }
  }

  private lazyPrograms(): LazyProgram[] {
    return [
      this.pathFill, this.pathFillVColor, this.gradFill, this.patternFill, ...Object.values(this.glyphPaintPrograms),
      ...this.batchVariants.lazy(),
    ];
  }

  private uploadQuadGeometry(): void {
    this.quad = {
      vertices: this.gpu.createBuffer('vertex', QUAD_VERTICES, 'static'),
      indices: this.gpu.createBuffer('index', QUAD_INDICES, 'static'),
    };
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
    this.programs.register(handle.id);
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

  /** The canvas pass this renderer draws in: its rect, scissored to it when
   *  it shares the drawing buffer. Begun anew each `render()`, because a
   *  co-tenant on the same context moves viewport and scissor between frames. */
  private canvasPass(): GpuPassDesc {
    const rect = this.glRect();
    return { target: null, viewport: rect, scissor: this.target ? rect : null };
  }

  /** This renderer's rect as GL addresses it, from the buffer's bottom left. */
  private glRect(): { x: number; y: number; width: number; height: number } {
    const { x, y, width, height } = this.deviceRect();
    if (!this.target) return { x: 0, y: 0, width, height };
    return { x, y: this.gpu.canvasSize().height - y - height, width, height };
  }

  /** Confine this renderer to a rect of its drawing buffer, or pass null to
   *  give it the whole buffer back. Takes effect from the next `render()`. */
  setTarget(target: RenderTarget | null): void {
    this.target = target;
  }

  getTarget(): RenderTarget | null { return this.target; }

  isContextLost(): boolean { return this.contextLost; }

  /** The GPU API this renderer draws with. */
  get backend(): RendererBackend { return this.gpu.language === 'wgsl' ? 'webgpu' : 'webgl2'; }

  private onContextLost(e: Event): void {
    e.preventDefault();
    this.contextLost = true;
  }

  private onContextRestored(): void {
    this.contextLost = false;
    this.gpu.beginFrame();
    // Every target and texture the pool held died with the context. `releaseAll` deletes handles that are already gone, which is a
    // no-op, and drops the bookkeeping that would otherwise hand a dead FBO to
    // the next group with effects.
    this.effectTargets.releaseAll();
    this.retained.releaseAll();
    this.paintScratch.release();
    this.paintResources.release();
    this.paintResources = createPaintResources();
    for (const lazy of this.lazyPrograms()) lazy.abandon();
    this.batchFill = createBatchFill(this.gpu);
    this.idComposite = null;
    this.meshCache = new GLMeshCache(this.gpu);
    this.textureCache = new GLTextureCache(this.gpu);
    this.imageCache.abandon();
    this.imageCache = new GLImageCache(this.gpu, this.imageMinification);
    this.gradRamps = new GradientRampAtlas(this.gpu);
    markAllFontsNotUploaded();

    this.uploadQuadGeometry();
    this.drawBatch = new DrawBatch(this.gpu, this.batchFill);
    this.whiteTexture = createWhiteTexture(this.gpu);
    this.programs.restore();
  }

  /** Free every GPU resource this renderer created and detach its
   *  context-loss listeners. Idempotent. The context itself is left alone, so
   *  a caller-owned context can host renderer after renderer without
   *  accumulating anything.
   *
   *  A disposed renderer ignores further `render()`, `registerProgram()` and `setImageMinification()`
   *  calls. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gpu = this.gpu;
    if (this.lossTarget) {
      this.lossTarget.removeEventListener('webglcontextlost', this.boundOnLost);
      this.lossTarget.removeEventListener('webglcontextrestored', this.boundOnRestored);
    }
    this.meshCache.dispose();
    this.paintResources.release();
    for (const lazy of this.lazyPrograms()) lazy.release();
    gpu.deleteProgram(this.batchFill);
    if (this.idComposite) gpu.deleteProgram(this.idComposite);
    this.idComposite = null;
    this.programs.dispose();
    this.textureCache.free();
    this.imageCache.dispose();
    this.gradRamps.free();
    if (this.quad) {
      gpu.deleteBuffer(this.quad.vertices);
      gpu.deleteBuffer(this.quad.indices);
    }
    this.quad = null;
    this.drawBatch.dispose();
    if (this.whiteTexture) gpu.deleteTexture(this.whiteTexture);
    this.whiteTexture = null;
    this.effectTargets.releaseAll();
    this.retained.releaseAll();
    this.paintScratch.release();
    gpu.dispose?.();
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
    const gpu = this.gpu;
    this.imageCache.beginFrame();
    this.beginFrame();
    this.retained.beginFrame([glyphGeneration(), textEngineGeneration(), textureRegistry.getVersion(),
      paintDrawKindRegistry.getVersion(), this.programs.epoch, this.flattenTolerance, this.widthCss, this.heightCss,
      this.dpr, this.imageMinification]);
    // New frame: refill the dynamic-glyph synchronous bake budget.
    resetBakeBudget(this.bakeBudget);
    // The effect buffer a frame that threw was drawing into, and whichever
    // offscreen buffer it had bound, are still out on loan.
    this.effectTargets.reclaim();
    gpu.beginFrame();
    const canvas = this.canvasPass();
    // Every stencil bit cleared, whatever the previous frame's clips left.
    gpu.beginPass(this.target?.clear !== false ? { ...canvas, clear: { color: true, stencil: true } } : canvas);
    const own = canvas.viewport;
    const ctx = this.frameContext(viewMatrix, opts?.screen, counters, {
      retained: this.retained, renderTarget: null, fragOrigin: [own.x, own.y], canvasPass: canvas,
    });
    try {
      drawStream(ctx, commands, opts?.spans ?? [], spanStats, counters);
    } finally {
      gpu.endPass();
    }
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

  /**
   * Draw `commands` as `render` would, into a buffer of the renderer's own
   * rather than the canvas, and read back which `GroupDrawCommand.pickId`
   * each device pixel ends up carrying. The canvas, `lastFrameStats` and
   * retained surfaces are left as they were: a retained group is drawn
   * straight through.
   *
   * The canvas's own frame cannot carry the ids beside its color: the default
   * framebuffer takes one color attachment, and the canvas's is multisampled,
   * which averages an id at every edge. So this is a second frame, culled to
   * `rect`, and asking about one pixel draws only what can reach it.
   *
   * An empty buffer where the context is lost or the renderer disposed.
   * Throws on WebGPU, which reads ids back only through `renderIdsAsync`.
   */
  renderIds(commands: DrawCommand[], viewMatrix?: GlMat3, opts: RenderIdsOptions = {}): IdBuffer {
    return this.idFrame(commands, viewMatrix, opts, true) as IdBuffer;
  }

  /** `renderIds`, its buffer read back asynchronously: on WebGL as well as
   *  WebGPU, where it is the only form. */
  renderIdsAsync(commands: DrawCommand[], viewMatrix?: GlMat3, opts: RenderIdsOptions = {}): Promise<IdBuffer> {
    return Promise.resolve(this.idFrame(commands, viewMatrix, opts, false));
  }

  /** The canvas's pixels in `rect`, device px from its top-left, as the last
   *  frame left them: RGBA, premultiplied, rows top-down. */
  readPixels(rect: PixelRect): Promise<Uint8Array> { return readPixels(this.gpu, rect); }

  /** `readPixels` answered at once. Throws on WebGPU, which reads back only through `readPixels`. */
  readPixelsSync(rect: PixelRect): Uint8Array { return readPixelsSync(this.gpu, rect); }

  private idFrame(commands: DrawCommand[], viewMatrix: GlMat3 | undefined, opts: RenderIdsOptions, sync: boolean): IdBuffer | Promise<IdBuffer> {
    if (this.contextLost || this.disposed) return { x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) };
    const device = this.deviceRect();
    this.beginFrame();
    const gpu = this.gpu;
    gpu.beginFrame();
    this.idComposite ??= createIdComposite(gpu);
    const spec = { ...opts, width: device.width, height: device.height, dpr: this.dpr };
    try {
      return drawIdFrame(gpu, this.effectTargets, this.idComposite, spec, commands, (renderTarget, ids, culled) => drawStream(
        this.frameContext(viewMatrix, opts.screen, undefined, { renderTarget, fragOrigin: [0, 0], ids }), culled, [], [], { drawCalls: 0 }), sync);
    } finally {
      // A throw must not leave a shared context bound to a target back in the pool.
      this.meshCache.freeTransient();
      gpu.beginFrame();
      gpu.beginPass(this.canvasPass());
      gpu.endPass();
    }
  }

  /** What every frame does before it draws. A frame that threw part-way never
   *  unwound: its group stack and staged vertices are still here. */
  private beginFrame(): void {
    // Free GPU resources whose Mesh was GC'd since the last frame. Done here,
    // before any draws — deleting from the FinalizationRegistry callback
    // directly races a draw in flight.
    this.meshCache.drainPendingDeletes();
    this.textureCache.sweep(textureRegistry);
    this.programs.refresh();
    this.groupState.reset();
    this.drawBatch.reset();
    // A frame that threw part-way left its clip here.
    this.drawBatch.clip = null;
  }

  /** The draw context of one frame; `target` says where it draws. */
  private frameContext(
    viewMatrix: GlMat3 | undefined, screenMatrix: GlMat3 | undefined,
    stats: { drawCalls: number } | undefined,
    target: Pick<DrawContext, 'renderTarget' | 'fragOrigin' | 'retained' | 'ids' | 'canvasPass'>,
  ): DrawContext {
    const device = this.deviceRect();
    const { pathFill, pathFillVColor, gradFill, patternFill } = this;
    return {
      gpu: this.gpu,
      get pathFill() { return pathFill.get(); },
      get pathFillVColor() { return pathFillVColor.get(); },
      batchFill: this.batchFill,
      batchVariants: this.batchVariants,
      get gradFill() { return gradFill.get(); },
      get patternFill() { return patternFill.get(); },
      meshCache: this.meshCache,
      textureCache: this.textureCache,
      imageCache: this.imageCache,
      gradRamps: this.gradRamps,
      programRegistry: this.programs.registry,
      ensureProgram: (id) => (this.disposed ? null : this.programs.ensure(id)),
      glyphPaintProgram: (kind) => this.glyphPaintPrograms[kind].get(),
      quad: this.quad,
      drawBatch: this.drawBatch,
      whiteTexture: this.whiteTexture,
      state: this.groupState,
      widthCss: this.widthCss,
      heightCss: this.heightCss,
      clipDepth: 0,
      clipStack: [],
      flattenTolerance: inCssPixels(this.flattenTolerance, this.dpr),
      textOutlineMinScreenSize: this.textOutlineMinScreenSize,
      viewMatrix, screenMatrix,
      effectTargets: this.effectTargets,
      paintScratch: this.paintScratch,
      deviceWidth: device.width,
      deviceHeight: device.height,
      paintResources: this.paintResources,
      stats,
      ...target,
    };
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
    const next = mode ?? 'auto';
    if (this.disposed || next === this.imageMinification) return;
    this.imageMinification = next;
    this.imageCache.dispose();
    this.imageCache = new GLImageCache(this.gpu, next);
  }

  resize(dims: { width: number; height: number; dpr: number }): void {
    this.widthCss = dims.width;
    this.heightCss = dims.height;
    this.dpr = dims.dpr;
    if (this.canvas) {
      this.canvas.width = Math.round(dims.width * dims.dpr);
      this.canvas.height = Math.round(dims.height * dims.dpr);
    }
  }

  /** @internal */ _gpu(): GpuDevice { return this.gpu; }
  /** @internal */ _pathFill(): ShaderProgram { return this.pathFill.get(); }
  /** @internal */ _pathFillVColor(): ShaderProgram { return this.pathFillVColor.get(); }
  /** @internal */ _drawBatch(): DrawBatch { return this.drawBatch; }
  /** @internal */ _batchFill(): ShaderProgram { return this.batchFill; }
  /** @internal */ _batchVariants(): BatchVariantPrograms { return this.batchVariants; }
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
