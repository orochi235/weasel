import { createPaintResources, type OwnedPaintResources } from './paintResources';
import type { ShaderProgram } from './shaders/ShaderProgram';
import type { GpuBuffer, GpuDevice, GpuTexture } from './gpu/types';
import {
  LazyProgram, PATH_FILL_SPEC, PATH_FILL_VCOLOR_SPEC, GRAD_FILL_SPEC, PATTERN_FILL_SPEC, GLYPH_PAINT_SPECS,
  BatchVariantPrograms, createBatchFill, GLYPH_LAYER_SPECS,
} from './shaders/builtinPrograms';
import { TextLayers } from './draw/textLayer';
import { GLMeshCache } from './cache/GLMeshCache';
import { GLTextureCache } from './cache/GLTextureCache';
import { GLImageCache, type ImageMinification } from './cache/GLImageCache';
import { GradientRampAtlas } from './cache/GradientRampAtlas';
import type { GlyphPaintKind } from './draw';
import { DrawBatch } from './drawBatch';
import { QUAD_VERTICES, QUAD_INDICES } from './shaders/customPrelude';
import { createWhiteTexture } from './cache/whiteTexture';

/**
 * The GPU state a renderer draws with that dies with its context: the
 * built-in programs, the mesh, texture, image and gradient caches, the batch,
 * and the shared quad and white texel. A restored context rebuilds all of it
 * (`restore`); `dispose` frees all of it.
 */
export class ContextResources {
  private readonly gpu: GpuDevice;
  /** Built on the first frame that draws with each, so a one-shot render of
   *  plain shapes builds the batch program alone. */
  readonly pathFill: LazyProgram;
  readonly pathFillVColor: LazyProgram;
  batchFill: ShaderProgram;
  readonly batchVariants: BatchVariantPrograms;
  readonly gradFill: LazyProgram;
  readonly patternFill: LazyProgram;
  /** Compiled on first use: only atlas text under a texture paint needs one. */
  readonly glyphPaintPrograms: Record<GlyphPaintKind, LazyProgram>;
  /** The text layer's point build and area build, compiled on first use. */
  readonly glyphLayerPrograms: readonly [LazyProgram, LazyProgram];
  textLayers: TextLayers;
  /** The program an id frame hands a group's ids back with; built by the first. */
  idComposite: ShaderProgram | null = null;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRamps: GradientRampAtlas;
  quad: { vertices: GpuBuffer; indices: GpuBuffer } | null = null;
  drawBatch: DrawBatch;
  /** 1x1 white, so a batch flush sampling no image still samples something —
   *  see `shaders/batchFill.ts`. */
  whiteTexture: GpuTexture | null = null;
  /** What registered paint kinds hang their GPU state on. One per context
   *  generation: a restore releases it and opens the next. */
  paintResources: OwnedPaintResources = createPaintResources();

  constructor(gpu: GpuDevice, imageMinification: ImageMinification) {
    this.gpu = gpu;
    this.pathFill = new LazyProgram(gpu, PATH_FILL_SPEC);
    this.pathFillVColor = new LazyProgram(gpu, PATH_FILL_VCOLOR_SPEC);
    this.gradFill = new LazyProgram(gpu, GRAD_FILL_SPEC);
    this.patternFill = new LazyProgram(gpu, PATTERN_FILL_SPEC);
    this.batchVariants = new BatchVariantPrograms(gpu);
    this.batchFill = createBatchFill(gpu);
    const glyph = (kind: GlyphPaintKind) => new LazyProgram(gpu, GLYPH_PAINT_SPECS[kind]);
    this.glyphPaintPrograms = { pattern: glyph('pattern'), gradient: glyph('gradient'), texture: glyph('texture') };
    this.glyphLayerPrograms = [new LazyProgram(gpu, GLYPH_LAYER_SPECS[0]), new LazyProgram(gpu, GLYPH_LAYER_SPECS[1])];
    this.textLayers = new TextLayers(gpu);

    this.meshCache = new GLMeshCache(gpu);
    this.textureCache = new GLTextureCache(gpu, (source) => this.imageCache.noteDrawn(source));
    this.imageCache = new GLImageCache(gpu, imageMinification);
    this.gradRamps = new GradientRampAtlas(gpu);
    this.uploadQuadGeometry();
    this.drawBatch = new DrawBatch(gpu, this.batchFill);
    this.whiteTexture = createWhiteTexture(gpu);
  }

  private lazyPrograms(): LazyProgram[] {
    return [
      this.pathFill, this.pathFillVColor, this.gradFill, this.patternFill, ...Object.values(this.glyphPaintPrograms),
      ...this.glyphLayerPrograms,
      ...this.batchVariants.lazy(),
    ];
  }

  private uploadQuadGeometry(): void {
    this.quad = {
      vertices: this.gpu.createBuffer('vertex', QUAD_VERTICES, 'static'),
      indices: this.gpu.createBuffer('index', QUAD_INDICES, 'static'),
    };
  }

  /** Rebuild everything after the context comes back. What the lost one held
   *  is dropped, not deleted: its handles died with it. */
  restore(imageMinification: ImageMinification): void {
    const gpu = this.gpu;
    this.paintResources.release();
    this.paintResources = createPaintResources();
    for (const lazy of this.lazyPrograms()) lazy.abandon();
    this.batchFill = createBatchFill(gpu);
    this.idComposite = null;
    this.textLayers.abandon();
    this.meshCache = new GLMeshCache(gpu);
    this.textureCache = new GLTextureCache(gpu, (source) => this.imageCache.noteDrawn(source));
    this.imageCache.abandon();
    this.imageCache = new GLImageCache(gpu, imageMinification);
    this.gradRamps = new GradientRampAtlas(gpu);

    this.uploadQuadGeometry();
    this.drawBatch = new DrawBatch(gpu, this.batchFill);
    this.whiteTexture = createWhiteTexture(gpu);
  }

  /** Free every image texture and sample images under `mode` from here on. */
  setImageMinification(mode: ImageMinification): void {
    this.imageCache.dispose();
    this.imageCache = new GLImageCache(this.gpu, mode);
  }

  /** Free every GPU resource held here. */
  dispose(): void {
    const gpu = this.gpu;
    this.meshCache.dispose();
    this.textLayers.dispose();
    this.paintResources.release();
    for (const lazy of this.lazyPrograms()) lazy.release();
    gpu.deleteProgram(this.batchFill);
    if (this.idComposite) gpu.deleteProgram(this.idComposite);
    this.idComposite = null;
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
  }
}
