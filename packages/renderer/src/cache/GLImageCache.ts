/**
 * Texture upload cache for ImageBitmap objects, keyed by source identity
 * (WeakMap) so GC can reclaim unreferenced bitmaps. A collected source's
 * texture is queued and deleted at the renderer's next frame; GC timing is
 * not prompt, so a source's owner that knows it will never be drawn again
 * frees it at once with {@link releaseImageSource}, and `dispose` frees them
 * all.
 *
 * Wrapping is set once at upload time. Texels are stored premultiplied,
 * whatever the source: what samples one divides the alpha back out before
 * any color math (`STRAIGHT_RGB_GLSL`).
 */

import type { GpuDevice, GpuFilter, GpuTexture, GpuWrap } from '../gpu/types';
import type { ImageTexSource } from './uploadPremultiplied';

export type PatternRepetition = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

/**
 * MIN_FILTER strategy for uploaded textures: `'linear'` never mipmaps,
 * `'mipmap'` does at upload, and `'auto'` builds a texture's mipmaps the
 * first time a frame draws the whole of it at half size or smaller. Only a
 * draw of the whole bitmap samples them: a sub-rect draw would blend in the
 * cells around its rect.
 */
export type ImageMinification = 'linear' | 'mipmap' | 'auto';

type TexSource = ImageTexSource;

/** Assumed when no live context has reported its `MAX_TEXTURE_SIZE`. Above
 *  WebGL2's guaranteed 2048, and at or below what every current GPU reports. */
const DEFAULT_MAX_TEXTURE_SIDE = 4096;

const live = new Set<GLImageCache>();

/** Free `key`'s texture in every live renderer. For an owner that has replaced
 *  a source and will never draw the old one again — a later draw of it simply
 *  re-uploads. */
export function releaseImageSource(key: object): void {
  for (const cache of live) cache.release(key);
}

/** Whether any live renderer drew `key` in the latest frame it rendered. */
export function imageSourceInLatestFrame(key: object): boolean {
  for (const cache of live) if (cache.drewInLatestFrame(key)) return true;
  return false;
}

/** The largest texture side every live renderer can hold: the smallest
 *  `MAX_TEXTURE_SIZE` among them, or a conservative default when none is live. */
export function maxImageTextureSide(): number {
  let side = Infinity;
  for (const cache of live) side = Math.min(side, cache.maxTextureSide);
  return Number.isFinite(side) ? side : DEFAULT_MAX_TEXTURE_SIDE;
}

export class GLImageCache {
  /** This context's `MAX_TEXTURE_SIZE`. */
  readonly maxTextureSide: number;

  private readonly map = new WeakMap<object, GpuTexture>();
  /** Every texture `map` holds, so `dispose` can reach them — a WeakMap
   *  cannot be enumerated. */
  private readonly textures = new Set<GpuTexture>();
  private readonly finalizer: FinalizationRegistry<GpuTexture>;
  private readonly pendingDeletes: GpuTexture[] = [];
  /** Under `'auto'`, the sources whose mipmaps are built. */
  private readonly mipped = new WeakSet<object>();
  private frame = 0;
  private readonly lastDrawn = new WeakMap<object, number>();

  /** `minification` selects the MIN_FILTER strategy for uploaded textures.
   *  `'mipmap'` generates mipmaps and filters LINEAR_MIPMAP_LINEAR: when a
   *  large source bitmap is drawn small, bilinear-only minification
   *  undersamples and produces moiré. `'auto'` pays for that only on the
   *  textures a frame draws small, when it first does. */
  constructor(
    private readonly gpu: GpuDevice,
    private readonly minification: ImageMinification = 'linear',
  ) {
    this.maxTextureSide = gpu.limits.maxTextureSize ?? DEFAULT_MAX_TEXTURE_SIDE;
    this.finalizer = new FinalizationRegistry<GpuTexture>((tex) => {
      if (this.textures.delete(tex)) this.pendingDeletes.push(tex);
    });
    live.add(this);
  }

  /** Open a frame: what {@link drewInLatestFrame} answers about from here on.
   *  The renderer calls this at the top of each `render()`. */
  beginFrame(): void {
    this.frame++;
    this.drainPendingDeletes();
  }

  /** Whether `key` was uploaded or bound since the last {@link beginFrame}. */
  drewInLatestFrame(key: object): boolean {
    return this.lastDrawn.get(key) === this.frame;
  }

  /** Count `key` as drawn this frame though another cache holds its texture: a registered
   *  texture's source, which is the image cache's own bitmap for an image pattern. */
  noteDrawn(key: object): void {
    this.lastDrawn.set(key, this.frame);
  }

  /** Delete the textures of sources collected since the last call. */
  drainPendingDeletes(): void {
    if (this.pendingDeletes.length === 0) return;
    for (const tex of this.pendingDeletes) this.gpu.deleteTexture(tex);
    this.pendingDeletes.length = 0;
  }

  /** Delete `key`'s texture, if it has one. */
  release(key: object): void {
    const tex = this.map.get(key);
    if (!tex) return;
    this.gpu.deleteTexture(tex);
    this.textures.delete(tex);
    this.finalizer.unregister(key);
    this.map.delete(key);
    this.lastDrawn.delete(key);
    this.mipped.delete(key);
  }

  /** Delete every texture this cache uploaded and stop answering
   *  {@link releaseImageSource} and {@link maxImageTextureSide}. Idempotent. */
  dispose(): void {
    for (const tex of this.textures) this.gpu.deleteTexture(tex);
    this.drainPendingDeletes();
    this.abandon();
  }

  /** {@link dispose} without the deletes, for a cache whose context was lost:
   *  its textures died with it. */
  abandon(): void {
    this.textures.clear();
    this.pendingDeletes.length = 0;
    live.delete(this);
  }

  upload(
    key: object,
    source: TexSource,
    repetition?: PatternRepetition,
  ): GpuTexture {
    this.lastDrawn.set(key, this.frame);
    const existing = this.map.get(key);
    if (existing) return existing;

    const [wrapS, wrapT] = wrapModes(repetition);
    const tex = this.gpu.createTexture('rgba8', { min: 'linear', mag: 'linear', wrapS, wrapT },
      { source, premultiply: true });
    if (this.minification === 'mipmap') {
      this.gpu.generateMipmaps(tex);
      this.mipped.add(key);
    }

    this.map.set(key, tex);
    this.textures.add(tex);
    this.finalizer.register(key, tex, key);
    return tex;
  }

  /** Whether `key` would gain from {@link buildMipmaps}: only under `'auto'`,
   *  and only until they are built. */
  lacksMipmaps(key: object): boolean {
    return this.minification === 'auto' && !this.mipped.has(key);
  }

  /** Whether `key`'s mipmaps are built. */
  hasMipmaps(key: object): boolean {
    return this.mipped.has(key);
  }

  /** Build `key`'s mipmaps, which a draw then samples through
   *  {@link setMinFilter}. Its texture must be uploaded. */
  buildMipmaps(key: object): void {
    const tex = this.map.get(key);
    if (!tex || this.mipped.has(key)) return;
    this.gpu.generateMipmaps(tex);
    this.mipped.add(key);
  }

  /** Minify `key`'s texture through its mipmaps when `mips` asks and it has
   *  them, else with one bilinear tap. Per flush, like {@link setMagFilter}:
   *  one bitmap can be drawn whole and by sub-rect in a frame. */
  setMinFilter(key: object, mips: boolean): void {
    this.gpu.setSampling(this.texture(key), { min: 'linear', mipmap: mips && this.mipped.has(key) });
  }

  /** The texture uploaded for `key`, counted as drawn this frame. */
  texture(key: object): GpuTexture {
    const tex = this.map.get(key);
    if (!tex) throw new Error('GLImageCache: image not uploaded; call upload() first');
    this.lastDrawn.set(key, this.frame);
    return tex;
  }

  /** Set `key`'s magnification filter. The same bitmap can be drawn at both
   *  filters in one frame, so a batch sets it per flush; the device skips a
   *  value the texture already holds. */
  setMagFilter(key: object, filter: GpuFilter): void {
    this.gpu.setSampling(this.texture(key), { mag: filter });
  }
}

function wrapModes(rep?: PatternRepetition): [GpuWrap, GpuWrap] {
  switch (rep) {
    case 'repeat':   return ['repeat', 'repeat'];
    case 'repeat-x': return ['repeat', 'clamp'];
    case 'repeat-y': return ['clamp', 'repeat'];
    default:         return ['clamp', 'clamp'];
  }
}
