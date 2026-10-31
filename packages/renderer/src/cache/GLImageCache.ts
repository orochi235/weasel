/**
 * GL texture upload cache for ImageBitmap objects, keyed by source identity
 * (WeakMap) so GC can reclaim unreferenced bitmaps. A collected source's
 * texture is queued and deleted at the renderer's next frame; GC timing is
 * not prompt, so a source's owner that knows it will never be drawn again
 * frees it at once with {@link releaseImageSource}, and `dispose` frees them
 * all.
 *
 * Wrapping is set once at upload time. Texels are stored premultiplied,
 * whatever the source: see `uploadPremultiplied`.
 */

import { uploadPremultiplied, type ImageTexSource } from './uploadPremultiplied';

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

  private readonly map = new WeakMap<object, WebGLTexture>();
  /** Every texture `map` holds, so `dispose` can reach them — a WeakMap
   *  cannot be enumerated. */
  private readonly textures = new Set<WebGLTexture>();
  /**
   * MAG_FILTER each texture currently carries, so a redundant write can be
   * skipped. The batch sets this per flush — the same bitmap can be drawn at
   * both filters in one frame — but filtering is state on the *texture
   * object*, not on the unit, so re-asserting a value it already has is a
   * write to a live texture for no reason.
   */
  private readonly magFilters = new WeakMap<object, number>();
  /** MIN_FILTER each texture carries, kept for the same reason. */
  private readonly minFilters = new WeakMap<object, number>();
  private readonly finalizer: FinalizationRegistry<WebGLTexture>;
  private readonly pendingDeletes: WebGLTexture[] = [];
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
    private readonly gl: WebGL2RenderingContext,
    private readonly minification: ImageMinification = 'linear',
  ) {
    const reported: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.maxTextureSide = typeof reported === 'number' && reported > 0
      ? reported
      : DEFAULT_MAX_TEXTURE_SIDE;
    this.finalizer = new FinalizationRegistry<WebGLTexture>((tex) => {
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

  /** Delete the textures of sources collected since the last call. */
  drainPendingDeletes(): void {
    if (this.pendingDeletes.length === 0) return;
    for (const tex of this.pendingDeletes) this.gl.deleteTexture(tex);
    this.pendingDeletes.length = 0;
  }

  /** Delete `key`'s texture, if it has one. */
  release(key: object): void {
    const tex = this.map.get(key);
    if (!tex) return;
    this.gl.deleteTexture(tex);
    this.textures.delete(tex);
    this.finalizer.unregister(key);
    this.map.delete(key);
    this.magFilters.delete(key);
    this.minFilters.delete(key);
    this.lastDrawn.delete(key);
    this.mipped.delete(key);
  }

  /** Delete every texture this cache uploaded and stop answering
   *  {@link releaseImageSource} and {@link maxImageTextureSide}. Idempotent. */
  dispose(): void {
    for (const tex of this.textures) this.gl.deleteTexture(tex);
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
  ): WebGLTexture {
    this.lastDrawn.set(key, this.frame);
    const existing = this.map.get(key);
    if (existing) return existing;

    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('GLImageCache: createTexture failed');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    uploadPremultiplied(gl, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    this.minFilters.set(key, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.magFilters.set(key, gl.LINEAR);

    const [wrapS, wrapT] = wrapModes(gl, repetition);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    if (this.minification === 'mipmap') {
      gl.generateMipmap(gl.TEXTURE_2D);
      this.mipped.add(key);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);

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

  /** Build `key`'s mipmaps, which a draw then samples through
   *  {@link setMinFilter}. Its texture must be uploaded. Leaves no texture bound. */
  buildMipmaps(key: object): void {
    const tex = this.map.get(key);
    if (!tex || this.mipped.has(key)) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.mipped.add(key);
  }

  /** Minify the texture bound for `key` through its mipmaps when `mips` asks
   *  and it has them, else with one bilinear tap. Per flush, like
   *  {@link setMagFilter}: one bitmap can be drawn whole and by sub-rect in a frame. */
  setMinFilter(key: object, mips: boolean): void {
    const gl = this.gl;
    const filter = mips && this.mipped.has(key) ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
    if (this.minFilters.get(key) === filter) return;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    this.minFilters.set(key, filter);
  }

  bind(key: object, unit: number): void {
    const tex = this.map.get(key);
    if (!tex) throw new Error('GLImageCache: image not uploaded; call upload() first');
    this.lastDrawn.set(key, this.frame);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /** Set `key`'s MAG_FILTER, skipping the call when it already holds that
   *  value. Its texture must be bound to the active unit — callers pair this
   *  with `bind`. */
  setMagFilter(key: object, filter: number): void {
    if (this.magFilters.get(key) === filter) return;
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, filter);
    this.magFilters.set(key, filter);
  }
}

function wrapModes(
  gl: WebGL2RenderingContext,
  rep?: PatternRepetition,
): [number, number] {
  switch (rep) {
    case 'repeat':   return [gl.REPEAT, gl.REPEAT];
    case 'repeat-x': return [gl.REPEAT, gl.CLAMP_TO_EDGE];
    case 'repeat-y': return [gl.CLAMP_TO_EDGE, gl.REPEAT];
    default:         return [gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE];
  }
}
