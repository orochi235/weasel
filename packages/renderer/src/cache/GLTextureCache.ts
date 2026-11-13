/**
 * Texture upload + cache, keyed by a string id (the font family name or
 * image id). The cache is context-bound; discard and create a new one on
 * context loss.
 *
 * Atlas format: RGBA UNSIGNED_BYTE, linear filtering, no mipmaps: mipmap
 * resampling corrupts the multi-channel SDF signal.
 */

import type { GpuDevice, GpuSampling, GpuTexture } from '../gpu/types';
import type { ImageTexSource } from './uploadPremultiplied';

type TexSource = ImageTexSource;

/** How a texture samples outside `0..1`. Pattern tiles need `'repeat'`;
 *  everything else clamps. Both backends repeat a texture of any size, so a
 *  tile of any size tiles correctly. */
export type TextureWrap = 'clamp' | 'repeat';

/** The part of the texture registry a sweep reads. */
export interface RegisteredTextureIds {
  getVersion(): number;
  has(id: string): boolean;
}

function sampled(wrap: TextureWrap): GpuSampling {
  return { min: 'linear', mag: 'linear', wrapS: wrap, wrapT: wrap };
}

const CLAMPED = sampled('clamp');

export class GLTextureCache {
  private readonly map = new Map<string, GpuTexture>();
  private readonly wraps = new Map<string, TextureWrap>();
  /** The source each registry-backed id was last uploaded from. */
  private readonly registered = new Map<string, TexSource>();
  private sweptVersion = -1;

  /** `drew` hears of each registry-backed source a draw binds, so the image cache spares it. */
  constructor(private readonly gpu: GpuDevice, private readonly drew?: (source: TexSource) => void) {}

  has(id: string): boolean {
    return this.map.has(id);
  }

  /** Uploads the pixels once per id. `wrap` is re-applied whenever it differs
   *  from what the id was last uploaded under: the same registered image can
   *  be a clamped shader texture in one draw and a repeating pattern tile in
   *  the next. */
  upload(id: string, source: TexSource, wrap: TextureWrap = 'clamp'): string {
    // A font atlas's channels are a distance field, not a color: sent as held.
    return this.ensure(id, source, wrap, false);
  }

  private ensure(id: string, source: TexSource, wrap: TextureWrap, premultiply: boolean): string {
    const cached = this.map.get(id);
    if (cached) {
      if (this.wraps.get(id) !== wrap) this.applyWrap(id, cached, wrap);
      return id;
    }

    const tex = this.gpu.createTexture('rgba8', sampled(wrap), { source, premultiply });
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
      this.gpu.writeTexture(cached, { source, premultiply: true });
    }
    this.registered.set(id, source);
    this.drew?.(source);
    return this.ensure(id, source, wrap, true);
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
      const tex = this.map.get(id);
      if (tex) this.gpu.deleteTexture(tex);
      this.map.delete(id);
      this.wraps.delete(id);
      this.registered.delete(id);
    }
  }

  private applyWrap(id: string, tex: GpuTexture, wrap: TextureWrap): void {
    this.gpu.setSampling(tex, { wrapS: wrap, wrapT: wrap });
    this.wraps.set(id, wrap);
  }

  /** Create a single-channel R8 texture from raw bytes (full upload).
   *  No-op if `id` already exists. Same LINEAR/CLAMP sampling as `upload`. */
  uploadR8(id: string, width: number, height: number, data: Uint8Array): void {
    if (this.map.has(id)) return;
    this.map.set(id, this.gpu.createTexture('r8', CLAMPED, { width, height, data }));
    this.wraps.set(id, 'clamp');
  }

  /** Patch a rect of an existing R8 texture with tightly-packed w×h bytes. */
  subImageR8(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void {
    this.gpu.writeSubTexture(this.texture(id), x, y, w, h, data);
  }

  /** Create a texture from premultiplied RGBA bytes that are a color: a page
   *  of color glyphs. Mipmapped, as a font atlas must never be, because one is
   *  drawn well below the size it was baked at. No-op if `id` already exists. */
  uploadRGBA(id: string, width: number, height: number, data: Uint8Array): void {
    if (this.map.has(id)) return;
    const gpu = this.gpu;
    const tex = gpu.createTexture('rgba8', { ...CLAMPED, mipmap: true }, { width, height, data });
    gpu.generateMipmaps(tex);
    this.map.set(id, tex);
    this.wraps.set(id, 'clamp');
  }

  /** Patch a rect of an existing RGBA texture with tightly-packed w×h texels. */
  subImageRGBA(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void {
    const tex = this.texture(id);
    this.gpu.writeSubTexture(tex, x, y, w, h, data);
    this.gpu.generateMipmaps(tex);
  }

  /** The texture uploaded for `id`. */
  texture(id: string): GpuTexture {
    const tex = this.map.get(id);
    if (!tex) throw new Error(`GLTextureCache: texture "${id}" not uploaded`);
    return tex;
  }

  /**
   * Delete every uploaded texture and clear the map. The cache is
   * refillable afterward.
   */
  free(): void {
    for (const tex of this.map.values()) this.gpu.deleteTexture(tex);
    this.map.clear();
    this.wraps.clear();
    this.registered.clear();
  }
}
