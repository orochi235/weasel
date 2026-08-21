/**
 * The only thing the glyph tier needs from a GL texture cache. Core's
 * `GLTextureCache` satisfies this structurally — there is no adapter and no
 * registration step, because the type *is* the seam.
 *
 * Declared here rather than imported so this package has zero reach-back into
 * core. If core's cache ever drops one of these methods, the failure surfaces
 * as a type error at the call site in `renderer/draw.ts`, which is where it
 * belongs.
 */

/** Anything WebGL can upload as a texture. */
export type TexSource = HTMLImageElement | ImageBitmap | ImageData | HTMLCanvasElement;

/** The texture-upload surface the glyph tier needs. Core's `GLTextureCache`
 *  satisfies it structurally, so nothing registers or adapts. */
export interface GlyphTextureSink {
  has(id: string): boolean;
  upload(id: string, source: TexSource): string;
  uploadR8(id: string, width: number, height: number, data: Uint8Array): void;
  subImageR8(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void;
}
