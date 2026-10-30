/**
 * GL texture upload + cache, keyed by a string id (the font family name or
 * image id). The cache is GL-context-bound; discard and create a new one on
 * context loss.
 *
 * Atlas format: RGBA UNSIGNED_BYTE, linear filtering, no mipmaps: mipmap
 * resampling corrupts the multi-channel SDF signal.
 */

import { uploadPremultiplied, type ImageTexSource } from './uploadPremultiplied';

type TexSource = ImageTexSource;

/** Send a source's bytes as it holds them. A font atlas's channels are a distance field, not a color. */
function uploadAsHeld(gl: WebGL2RenderingContext, source: TexSource): void {
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

/** How a texture samples outside `0..1`. Pattern tiles need `'repeat'`;
 *  everything else clamps. WebGL2 allows `REPEAT` on NPOT textures, so a
 *  tile of any size tiles correctly. */
export type TextureWrap = 'clamp' | 'repeat';

/** The part of the texture registry a sweep reads. */
export interface RegisteredTextureIds {
  getVersion(): number;
  has(id: string): boolean;
}

export class GLTextureCache {
  private readonly map = new Map<string, WebGLTexture>();
  private readonly wraps = new Map<string, TextureWrap>();
  /** The source each registry-backed id was last uploaded from. */
  private readonly registered = new Map<string, TexSource>();
  private sweptVersion = -1;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  has(id: string): boolean {
    return this.map.has(id);
  }

  /** Uploads the pixels once per id. `wrap` is re-applied whenever it differs
   *  from what the id was last uploaded under: the same registered image can
   *  be a clamped shader texture in one draw and a repeating pattern tile in
   *  the next. */
  upload(id: string, source: TexSource, wrap: TextureWrap = 'clamp'): string {
    return this.ensure(id, source, wrap, uploadAsHeld);
  }

  private ensure(id: string, source: TexSource, wrap: TextureWrap, send: typeof uploadAsHeld): string {
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
    send(gl, source);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(id, tex);
    this.wraps.set(id, wrap);
    return id;
  }

  /** `upload` for an id from the texture registry, whose image can be replaced
   *  under the same id: a changed source sends its pixels again. A registered
   *  texture is an image, so its texels are premultiplied. */
  uploadRegistered(id: string, source: TexSource, wrap: TextureWrap = 'clamp'): string {
    const cached = this.map.get(id);
    if (cached && this.registered.get(id) !== source) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, cached);
      uploadPremultiplied(gl, source);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    this.registered.set(id, source);
    return this.ensure(id, source, wrap, uploadPremultiplied);
  }

  /** Whether `uploadRegistered(id, source)` would send new pixels to a
   *  texture already made for `id`. */
  replaces(id: string, source: TexSource): boolean {
    return this.map.has(id) && this.registered.get(id) !== source;
  }

  /**
   * Delete the texture of every registry-backed id the registry has dropped.
   * The renderer calls this at the top of `render()`, before any draw, so a
   * texture is never deleted under a draw that has it bound.
   */
  sweep(registry: RegisteredTextureIds): void {
    const version = registry.getVersion();
    if (version === this.sweptVersion) return;
    this.sweptVersion = version;
    for (const id of this.registered.keys()) {
      if (registry.has(id)) continue;
      this.gl.deleteTexture(this.map.get(id) ?? null);
      this.map.delete(id);
      this.wraps.delete(id);
      this.registered.delete(id);
    }
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

  /** Create a texture from premultiplied RGBA bytes that are a color: a page
   *  of color glyphs. Mipmapped, as a font atlas must never be, because one is
   *  drawn well below the size it was baked at. No-op if `id` already exists. */
  uploadRGBA(id: string, width: number, height: number, data: Uint8Array): void {
    if (this.map.has(id)) return;
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error(`GLTextureCache: createTexture failed for id="${id}"`);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.map.set(id, tex);
    this.wraps.set(id, 'clamp');
  }

  /** Patch a rect of an existing RGBA texture with tightly-packed w×h texels. */
  subImageRGBA(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void {
    const tex = this.map.get(id);
    if (!tex) throw new Error(`GLTextureCache: texture "${id}" not uploaded`);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
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
   * Delete every uploaded GL texture and clear the map. The cache is
   * refillable afterward.
   */
  free(): void {
    const gl = this.gl;
    for (const tex of this.map.values()) {
      gl.deleteTexture(tex);
    }
    this.map.clear();
    this.wraps.clear();
    this.registered.clear();
  }
}
