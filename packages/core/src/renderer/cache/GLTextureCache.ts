/**
 * GL texture upload + cache for MSDF font atlases (and future images).
 *
 * Textures are keyed by a string id (the font family name or image id).
 * Pixels are uploaded once per id; a later upload of the same id reuses the
 * texture and only re-applies its wrap mode when that changed.
 * The cache is GL-context-bound; discard and create a new one on context loss.
 *
 * Atlas format: RGBA UNSIGNED_BYTE, linear filtering, no mipmaps.
 * Mipmap generation is deliberately skipped — MSDF works correctly with
 * linear filtering, and mipmap resampling corrupts the multi-channel SDF signal.
 */

type TexSource = HTMLImageElement | ImageBitmap | ImageData | HTMLCanvasElement;

/** How a texture samples outside `0..1`. Pattern tiles need `'repeat'`;
 *  everything else clamps. WebGL2 allows `REPEAT` on NPOT textures, so a
 *  tile of any size tiles correctly. */
export type TextureWrap = 'clamp' | 'repeat';

export class GLTextureCache {
  private readonly map = new Map<string, WebGLTexture>();
  private readonly wraps = new Map<string, TextureWrap>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  has(id: string): boolean {
    return this.map.has(id);
  }

  /** Uploads the pixels once per id. `wrap` is re-applied whenever it differs
   *  from what the id was last uploaded under: the same registered image can
   *  be a clamped shader texture in one draw and a repeating pattern tile in
   *  the next, and first-upload-wins gave the second one the first one's mode. */
  upload(id: string, source: TexSource, wrap: TextureWrap = 'clamp'): string {
    const cached = this.map.get(id);
    if (cached) {
      if (this.wraps.get(id) !== wrap) this.applyWrap(id, cached, wrap);
      return id;
    }

    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error(`GLTextureCache: createTexture failed for id="${id}"`);

    const wrapMode = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(id, tex);
    this.wraps.set(id, wrap);
    return id;
  }

  private applyWrap(id: string, tex: WebGLTexture, wrap: TextureWrap): void {
    const gl = this.gl;
    const mode = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mode);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.wraps.set(id, wrap);
  }

  /** Create a single-channel R8 texture from raw bytes (full upload).
   *  No-op if `id` already exists. Same LINEAR/CLAMP params as `upload`;
   *  UNPACK_ALIGNMENT dropped to 1 for non-4-aligned row widths. */
  uploadR8(id: string, width: number, height: number, data: Uint8Array): void {
    if (this.map.has(id)) return;
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error(`GLTextureCache: createTexture failed for id="${id}"`);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.map.set(id, tex);
    this.wraps.set(id, 'clamp');
  }

  /** Patch a rect of an existing R8 texture with tightly-packed w×h bytes. */
  subImageR8(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void {
    const tex = this.map.get(id);
    if (!tex) throw new Error(`GLTextureCache: texture "${id}" not uploaded`);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  bind(id: string, unit: number): void {
    const tex = this.map.get(id);
    if (!tex) throw new Error(`GLTextureCache: texture "${id}" not uploaded`);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /**
   * Delete every uploaded GL texture and clear the map. Called by
   * `WeaselRenderer.dispose()`. The cache is unusable but refillable
   * afterward — a subsequent `upload()` for a previously-seen id re-creates
   * the texture rather than restoring the deleted one.
   */
  free(): void {
    const gl = this.gl;
    for (const tex of this.map.values()) {
      gl.deleteTexture(tex);
    }
    this.map.clear();
    this.wraps.clear();
  }
}
