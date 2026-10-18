/**
 * The dynamic glyph atlas's pages: their CPU-side bytes, and bringing each
 * renderer's texture of one up to date. Three sets: distance fields, one byte a
 * texel; color glyphs, four; and color glyphs baked again larger, four, on
 * pages that fill and empty on their own.
 */

import type { GlyphTextureSink } from '../textureSink';

/** Side of every dynamic-atlas page, in texels: a glyph's rect over it is its uv. */
export const PAGE_SIZE = 1024;
export const MAX_PAGES = 4;

interface DynamicPage {
  data: Uint8Array;
  /** Bumps on every write; each write appends a patch with seq = version. */
  version: number;
  patches: { seq: number; x: number; y: number; w: number; h: number }[];
}

/** How one set of pages reaches a texture. */
interface PageFormat {
  /** Bytes per texel. */
  channels: number;
  idPrefix: string;
  upload(cache: GlyphTextureSink, id: string, data: Uint8Array): void;
  patch(cache: GlyphTextureSink, id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void;
}

class PageSet {
  pages: DynamicPage[] = [];
  // Per-GL-cache upload progress: last page version each cache has seen.
  // WeakMap-keyed so disposed renderers don't pin anything.
  private uploaded = new WeakMap<GlyphTextureSink, Map<number, number>>();

  constructor(private readonly format: PageFormat) {}

  textureId(page: number): string {
    return `${this.format.idPrefix}${page}`;
  }

  /** Copy a `w`×`h` block of texels into page `pageIndex` at `(x, y)`. */
  blit(pageIndex: number, x: number, y: number, w: number, h: number, bytes: Uint8Array | Uint8ClampedArray): void {
    const n = this.format.channels;
    while (this.pages.length <= pageIndex) {
      this.pages.push({ data: new Uint8Array(PAGE_SIZE * PAGE_SIZE * n), version: 0, patches: [] });
    }
    const page = this.pages[pageIndex];
    for (let row = 0; row < h; row++) {
      page.data.set(bytes.subarray(row * w * n, (row + 1) * w * n), ((y + row) * PAGE_SIZE + x) * n);
    }
    page.version++;
    page.patches.push({ seq: page.version, x, y, w, h });
  }

  /** Zero every page. One whole-page patch stands in for all the patches before it. */
  clear(): void {
    for (const page of this.pages) {
      page.data.fill(0);
      page.version++;
      page.patches = [{ seq: page.version, x: 0, y: 0, w: PAGE_SIZE, h: PAGE_SIZE }];
    }
  }

  /** Bring `cache`'s copy of page `pageIndex` up to date: a full upload the
   *  first time, patches after. Returns false if the page doesn't exist yet. */
  sync(cache: GlyphTextureSink, pageIndex: number): boolean {
    const page = this.pages[pageIndex];
    if (!page) return false;
    const n = this.format.channels;
    const id = this.textureId(pageIndex);
    let seen = this.uploaded.get(cache);
    if (!seen) {
      seen = new Map();
      this.uploaded.set(cache, seen);
    }
    if (!cache.has(id)) {
      this.format.upload(cache, id, page.data);
      seen.set(pageIndex, page.version);
      return true;
    }
    const last = seen.get(pageIndex) ?? 0;
    if (last >= page.version) return true;
    for (const patch of page.patches) {
      if (patch.seq <= last) continue;
      const tight = new Uint8Array(patch.w * patch.h * n);
      for (let row = 0; row < patch.h; row++) {
        const src = ((patch.y + row) * PAGE_SIZE + patch.x) * n;
        tight.set(page.data.subarray(src, src + patch.w * n), row * patch.w * n);
      }
      this.format.patch(cache, id, patch.x, patch.y, patch.w, patch.h, tight);
    }
    seen.set(pageIndex, page.version);
    return true;
  }
}

const fields = new PageSet({
  channels: 1,
  idPrefix: 'weasel-dyn-sdf-page-',
  upload: (cache, id, data) => cache.uploadR8(id, PAGE_SIZE, PAGE_SIZE, data),
  patch: (cache, id, x, y, w, h, data) => cache.subImageR8(id, x, y, w, h, data),
});

const colors = new PageSet({
  channels: 4,
  idPrefix: 'weasel-dyn-color-page-',
  upload: (cache, id, data) => cache.uploadRGBA(id, PAGE_SIZE, PAGE_SIZE, data),
  patch: (cache, id, x, y, w, h, data) => cache.subImageRGBA(id, x, y, w, h, data),
});

const sharpColors = new PageSet({
  channels: 4,
  idPrefix: 'weasel-dyn-color-sharp-page-',
  upload: (cache, id, data) => cache.uploadRGBA(id, PAGE_SIZE, PAGE_SIZE, data),
  patch: (cache, id, x, y, w, h, data) => cache.subImageRGBA(id, x, y, w, h, data),
});

/** Copy a `w`×`h` block of field bytes into field page `pageIndex` at `(x, y)`. */
export function blitToPage(
  pageIndex: number, x: number, y: number, w: number, h: number, bytes: Uint8Array,
): void {
  fields.blit(pageIndex, x, y, w, h, bytes);
}

/** Copy a `w`×`h` block of premultiplied RGBA texels into color page `pageIndex` at `(x, y)`. */
export function blitToColorPage(
  pageIndex: number, x: number, y: number, w: number, h: number, rgba: Uint8ClampedArray,
): void {
  colors.blit(pageIndex, x, y, w, h, rgba);
}

/** Copy a `w`×`h` block of premultiplied RGBA texels into sharp color page `pageIndex` at `(x, y)`. */
export function blitToSharpColorPage(
  pageIndex: number, x: number, y: number, w: number, h: number, rgba: Uint8ClampedArray,
): void {
  sharpColors.blit(pageIndex, x, y, w, h, rgba);
}

/** Zero every page of every set. */
export function clearPages(): void {
  fields.clear();
  colors.clear();
  sharpColors.clear();
}

/** Zero the sharp color pages alone. */
export function clearSharpPages(): void {
  sharpColors.clear();
}

/** Texture-cache key for a dynamic field page (parallel to `textureCacheKey`). */
export function dynamicPageTextureId(page: number): string {
  return fields.textureId(page);
}

/** Texture-cache key for a page of color glyphs. */
export function colorPageTextureId(page: number): string {
  return colors.textureId(page);
}

/** Texture-cache key for a page of color glyphs baked larger. */
export function sharpColorPageTextureId(page: number): string {
  return sharpColors.textureId(page);
}

/** Bring `cache`'s copy of field page `pageIndex` up to date: full R8 upload
 *  the first time, `texSubImage2D` patches after. Returns false if the page
 *  doesn't exist yet. */
export function syncDynamicPageTexture(cache: GlyphTextureSink, pageIndex: number): boolean {
  return fields.sync(cache, pageIndex);
}

/** The same for a page of color glyphs, whose texels are premultiplied RGBA. */
export function syncColorPageTexture(cache: GlyphTextureSink, pageIndex: number): boolean {
  return colors.sync(cache, pageIndex);
}

/** The same for a page of color glyphs baked larger. */
export function syncSharpColorPageTexture(cache: GlyphTextureSink, pageIndex: number): boolean {
  return sharpColors.sync(cache, pageIndex);
}

/** @internal test seam — inspect CPU-side field pages. */
export function _getPagesForTests(): readonly DynamicPage[] {
  return fields.pages;
}

/** @internal test seam — inspect CPU-side color pages. */
export function _getColorPagesForTests(): readonly DynamicPage[] {
  return colors.pages;
}

/** @internal test seam — inspect CPU-side sharp color pages. */
export function _getSharpColorPagesForTests(): readonly DynamicPage[] {
  return sharpColors.pages;
}

/** @internal test seam — forget every page. */
export function _resetPagesForTests(): void {
  fields.pages = [];
  colors.pages = [];
  sharpColors.pages = [];
}
