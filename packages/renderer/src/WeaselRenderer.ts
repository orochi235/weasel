import type { ShaderProgram } from './shaders/ShaderProgram';
import type { GpuDevice, GpuPassDesc } from './gpu/types';
import { openWebGL } from './gpu/webgl/openWebGL';
import { openWebGPU } from './gpu/webgpu/openWebGPU';
import { glyphGeneration, resetBakeBudget, DEFAULT_BAKE_BUDGET } from '@weasel-js/font';
import { textEngineGeneration } from '@weasel-js/text';
import { PaintScratch } from './paintScratch';
import { textureRegistry } from './textures/registerTexture';
import type { ImageMinification } from './cache/GLImageCache';
import { GroupState } from './state/GroupState';
import type { DrawCommand } from './DrawCommand';
import { inCssPixels, type FlattenTolerance } from './draw/flattenTolerance';
import type { GlMat3, Rect } from '@weasel-js/geom';
import { OUTLINE_MIN_SCREEN_PX, type DrawContext } from './draw';
import { drawStream, now } from './drawStream';
import { drawIdFrame } from './draw/idRender';
import { readPixels, readPixelsSync } from './readPixels';
import { createIdComposite } from './draw/idComposite';
import { registerRendererParts } from './rendererParts';
import type { ShaderProgramHandle } from './shaders/registerProgram';
import { CustomPrograms } from './shaders/CustomPrograms';
import { EffectTargets } from './effects/EffectTargets';
import { RetainedSurfaces } from './retain/RetainedSurfaces';
import { ContextResources } from './contextResources';
import { canvasPassFor, deviceRectFor, sizeCanvas, type DeviceRect } from './targetRect';
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
  private readonly res: ContextResources;
  private readonly programs: CustomPrograms;
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

  constructor(opts: WeaselRendererOptions) {
    const { device, lossTarget } = opts.gpu ? { ...openWebGPU(opts.gpu), lossTarget: null } : openWebGL(opts);
    this.gpu = device;
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
    if (this.canvas) sizeCanvas(this.canvas, opts.width, opts.height, opts.dpr);
    this.gpu.beginFrame();

    const res = new ContextResources(this.gpu, this.imageMinification);
    this.res = res;
    registerRendererParts(this, () => ({
      drawBatch: res.drawBatch, batchVariants: res.batchVariants, meshCache: res.meshCache,
      textureCache: res.textureCache, imageCache: res.imageCache, gradRamps: res.gradRamps,
      groupState: this.groupState,
    }));
    // Last: a constructor that throws (a lost context fails the compile above) must leave no listener to rebuild it.
    const events: Partial<EventTarget> | null = opts.gpu ? null : this.canvas ?? lossTarget;
    if (events && typeof events.addEventListener === 'function') {
      this.lossTarget = events as EventTarget;
      this.lossTarget.addEventListener('webglcontextlost', this.boundOnLost);
      this.lossTarget.addEventListener('webglcontextrestored', this.boundOnRestored);
    }
  }

  /**
   * Compile a consumer-registered shader program against this renderer's GL context.
   *
   * Optional: a program compiles on the first frame that draws with it. Call
   * this after the module-level `registerProgram()` to pay for the compile
   * before that frame, or to catch the `ShaderCompileError` it throws.
   *
   * A source replaced in the module-level registry (`replace: true`) recompiles on the next frame.
   */
  registerProgram(handle: ShaderProgramHandle): void {
    // A disposed renderer must not compile programs into the cleared registry.
    if (this.disposed) return;
    this.programs.register(handle.id);
  }

  private deviceRect(): DeviceRect {
    return deviceRectFor(this.target, this.widthCss, this.heightCss, this.dpr);
  }

  private canvasPass(): GpuPassDesc {
    return canvasPassFor(this.deviceRect(), this.target, this.gpu);
  }

  /** Confine this renderer to a rect of its drawing buffer, or pass null to
   *  give it the whole buffer back. Takes effect from the next `render()`. */
  setTarget(target: RenderTarget | null): void {
    this.target = target;
  }

  getTarget(): RenderTarget | null { return this.target; }

  /** A WebGL context says so by event; a WebGPU device is asked, since it does not come back. */
  isContextLost(): boolean { return this.contextLost || (this.backend === 'webgpu' && this.gpu.isContextLost()); }

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
    this.res.restore(this.imageMinification);
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
    if (this.lossTarget) {
      this.lossTarget.removeEventListener('webglcontextlost', this.boundOnLost);
      this.lossTarget.removeEventListener('webglcontextrestored', this.boundOnRestored);
    }
    this.res.dispose();
    this.programs.dispose();
    this.effectTargets.releaseAll();
    this.retained.releaseAll();
    this.paintScratch.release();
    this.gpu.dispose?.();
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
    if (this.disposed || this.isContextLost()) return;
    const t0 = now();
    const counters = { drawCalls: 0 };
    const spanStats: RenderSpanStats[] = [];
    this.stats = { drawCalls: 0, ms: 0, spans: spanStats, retained: NO_RETAINED };
    const gpu = this.gpu;
    this.res.imageCache.beginFrame();
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
    this.res.meshCache.freeTransient();
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
  readPixels(rect: Rect): Promise<Uint8Array> { return readPixels(this.gpu, rect); }

  /** `readPixels` answered at once. Throws on WebGPU, which reads back only through `readPixels`. */
  readPixelsSync(rect: Rect): Uint8Array { return readPixelsSync(this.gpu, rect); }

  private idFrame(commands: DrawCommand[], viewMatrix: GlMat3 | undefined, opts: RenderIdsOptions, sync: boolean): IdBuffer | Promise<IdBuffer> {
    if (this.disposed || this.isContextLost()) return { x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) };
    const device = this.deviceRect();
    this.beginFrame();
    const gpu = this.gpu;
    gpu.beginFrame();
    const res = this.res;
    res.idComposite ??= createIdComposite(gpu);
    const spec = { ...opts, width: device.width, height: device.height, dpr: this.dpr };
    try {
      return drawIdFrame(gpu, this.effectTargets, res.idComposite, spec, commands, (renderTarget, ids, culled) => drawStream(
        this.frameContext(viewMatrix, opts.screen, undefined, { renderTarget, fragOrigin: [0, 0], ids }), culled, [], [], { drawCalls: 0 }), sync);
    } finally {
      // A throw must not leave a shared context bound to a target back in the pool.
      res.meshCache.freeTransient();
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
    const res = this.res;
    res.meshCache.drainPendingDeletes();
    res.textureCache.sweep(textureRegistry);
    this.programs.refresh();
    this.groupState.reset();
    res.drawBatch.reset();
    // A frame that threw part-way left its clip here.
    res.drawBatch.clip = null;
  }

  /** The draw context of one frame; `target` says where it draws. */
  private frameContext(
    viewMatrix: GlMat3 | undefined, screenMatrix: GlMat3 | undefined,
    stats: { drawCalls: number } | undefined,
    target: Pick<DrawContext, 'renderTarget' | 'fragOrigin' | 'retained' | 'ids' | 'canvasPass'>,
  ): DrawContext {
    const device = this.deviceRect();
    const res = this.res;
    const { pathFill, pathFillVColor, gradFill, patternFill, glyphPaintPrograms } = res;
    return {
      gpu: this.gpu,
      get pathFill() { return pathFill.get(); },
      get pathFillVColor() { return pathFillVColor.get(); },
      batchFill: res.batchFill,
      batchVariants: res.batchVariants,
      get gradFill() { return gradFill.get(); },
      get patternFill() { return patternFill.get(); },
      meshCache: res.meshCache,
      textureCache: res.textureCache,
      imageCache: res.imageCache,
      gradRamps: res.gradRamps,
      programRegistry: this.programs.registry,
      ensureProgram: (id) => (this.disposed ? null : this.programs.ensure(id)),
      glyphPaintProgram: (kind) => glyphPaintPrograms[kind].get(),
      quad: res.quad,
      drawBatch: res.drawBatch,
      whiteTexture: res.whiteTexture,
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
      paintResources: res.paintResources,
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
    this.res.setImageMinification(next);
  }

  resize(dims: { width: number; height: number; dpr: number }): void {
    this.widthCss = dims.width;
    this.heightCss = dims.height;
    this.dpr = dims.dpr;
    if (this.canvas) sizeCanvas(this.canvas, dims.width, dims.height, dims.dpr);
  }

  /** @internal */ _gpu(): GpuDevice { return this.gpu; }
  /** @internal */ _pathFill(): ShaderProgram { return this.res.pathFill.get(); }
  /** @internal */ _pathFillVColor(): ShaderProgram { return this.res.pathFillVColor.get(); }
  /** @internal */ _batchFill(): ShaderProgram { return this.res.batchFill; }
  /** @internal */ _gradFill(): ShaderProgram { return this.res.gradFill.get(); }
  /** @internal */ _patternFill(): ShaderProgram { return this.res.patternFill.get(); }
  /** @internal */ _widthCss(): number { return this.widthCss; }
  /** @internal */ _heightCss(): number { return this.heightCss; }
  /** @internal */ _dpr(): number { return this.dpr; }
}
