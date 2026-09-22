/**
 * GL texture upload cache for ImageBitmap objects.
 *
 * Key: ImageBitmap (or pattern source object) identity (WeakMap) — lets GC
 * reclaim unreferenced bitmaps. The GL textures are NOT freed when the source
 * is gc'd; a source's owner that knows it will never be drawn again frees them
 * with {@link releaseImageSource}.
 *
 * Wrapping is set once at upload time per the `repetition` parameter:
 *   - undefined / 'no-repeat' → CLAMP_TO_EDGE
 *   - 'repeat'   → REPEAT (both axes)
 *   - 'repeat-x' → REPEAT on S, CLAMP on T
 *   - 'repeat-y' → CLAMP on S, REPEAT on T
 *
 * Convention §2: texels stored straight; shader premultiplies.
 */

export type PatternRepetition = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

/** MIN_FILTER strategy for uploaded textures. */
export type ImageMinification = 'linear' | 'mipmap';

type TexSource = ImageBitmap | ImageData | HTMLCanvasElement | HTMLImageElement;

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
  /**
   * MAG_FILTER each texture currently carries, so a redundant write can be
   * skipped.
   *
   * The batch sets this per flush — the same bitmap can be drawn at both
   * filters in one frame, and the value has to be right at the draw rather than
   * at upload. Filtering is state on the *texture object*, though, not on the
   * unit, so re-asserting a value it already has is a write to a live texture
   * for no reason. On a large sheet that is not free: a consumer's wall samples
   * a 5652px-square atlas, 122MB resident, and measured `sampling: 'nearest'`
   * costing up to 8x `'linear'` there — where the linear pass re-asserts the
   * upload default and the nearest pass changes state on every draw.
   *
   * Whether that is the cause is unproven (see `docs/TODO.md`), but the write
   * was redundant either way.
   */
  private readonly magFilters = new WeakMap<object, number>();

  /** `minification` selects the MIN_FILTER strategy for uploaded textures.
   *  `'linear'` (default) is the screen path's existing behavior. `'mipmap'`
   *  generates mipmaps and filters LINEAR_MIPMAP_LINEAR — required for
   *  quality minification when a large source bitmap is drawn small (the
   *  headless print/export path); bilinear-only minification undersamples
   *  and produces moiré. */
  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly minification: ImageMinification = 'linear',
  ) {
    const reported: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.maxTextureSide = typeof reported === 'number' && reported > 0
      ? reported
      : DEFAULT_MAX_TEXTURE_SIDE;
    live.add(this);
  }

  /** Delete `key`'s texture, if it has one. */
  release(key: object): void {
    const tex = this.map.get(key);
    if (!tex) return;
    this.gl.deleteTexture(tex);
    this.map.delete(key);
    this.magFilters.delete(key);
  }

  /** Stop answering {@link releaseImageSource} and {@link maxImageTextureSide}.
   *  Call when the context is disposed or lost. */
  dispose(): void {
    live.delete(this);
  }

  upload(
    key: object,
    source: TexSource,
    repetition?: PatternRepetition,
  ): WebGLTexture {
    const existing = this.map.get(key);
    if (existing) return existing;

    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('GLImageCache: createTexture failed');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      this.minification === 'mipmap' ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.magFilters.set(key, gl.LINEAR);

    const [wrapS, wrapT] = wrapModes(gl, repetition);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    if (this.minification === 'mipmap') gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(key, tex);
    return tex;
  }

  bind(key: object, unit: number): void {
    const tex = this.map.get(key);
    if (!tex) throw new Error('GLImageCache: image not uploaded; call upload() first');
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
