/**
 * GL texture upload + cache for MSDF font atlases (and future images).
 *
 * Textures are keyed by a string id (the font family name or image id).
 * Upload happens once; subsequent uploads for the same id are no-ops.
 * The cache is GL-context-bound; discard and create a new one on context loss.
 *
 * Atlas format: RGBA UNSIGNED_BYTE, linear filtering, no mipmaps.
 * Mipmap generation is deliberately skipped — MSDF works correctly with
 * linear filtering, and mipmap resampling corrupts the multi-channel SDF signal.
 */

type TexSource = HTMLImageElement | ImageBitmap | ImageData | HTMLCanvasElement;

export class GLTextureCache {
  private readonly map = new Map<string, WebGLTexture>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  has(id: string): boolean {
    return this.map.has(id);
  }

  upload(id: string, source: TexSource): string {
    if (this.map.has(id)) return id;

    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error(`GLTextureCache: createTexture failed for id="${id}"`);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(id, tex);
    return id;
  }

  bind(id: string, unit: number): void {
    const tex = this.map.get(id);
    if (!tex) throw new Error(`GLTextureCache: texture "${id}" not uploaded`);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }
}
