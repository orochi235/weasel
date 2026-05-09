/**
 * GL texture upload cache for ImageBitmap objects.
 *
 * Key: ImageBitmap (or pattern source object) identity (WeakMap) — lets GC
 * reclaim unreferenced bitmaps. The GL textures are NOT freed when the source
 * is gc'd; deferred to v2.
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

type TexSource = ImageBitmap | ImageData | HTMLCanvasElement | HTMLImageElement;

export class GLImageCache {
  private readonly map = new WeakMap<object, WebGLTexture>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const [wrapS, wrapT] = wrapModes(gl, repetition);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
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
