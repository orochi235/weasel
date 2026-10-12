/**
 * The dynamic glyph atlas's pages: their CPU-side bytes, and bringing each
 * renderer's texture of one up to date.
 */

import type { GlyphTextureSink } from '../textureSink';

export const PAGE_SIZE = 1024;
export const MAX_PAGES = 4;

interface DynamicPage {
  data: Uint8Array;
  /** Bumps on every write; each write appends a patch with seq = version. */
  version: number;
  patches: { seq: number; x: number; y: number; w: number; h: number }[];
}

let pages: DynamicPage[] = [];

/** Copy a `w`×`h` block of field bytes into page `pageIndex` at `(x, y)`. */
export function blitToPage(
  pageIndex: number, x: number, y: number, w: number, h: number, bytes: Uint8Array,
): void {
  while (pages.length <= pageIndex) {
    pages.push({ data: new Uint8Array(PAGE_SIZE * PAGE_SIZE), version: 0, patches: [] });
  }
  const page = pages[pageIndex];
  for (let row = 0; row < h; row++) {
    page.data.set(bytes.subarray(row * w, (row + 1) * w), (y + row) * PAGE_SIZE + x);
  }
  page.version++;
  page.patches.push({ seq: page.version, x, y, w, h });
}

/** Zero every page. One whole-page patch stands in for all the patches before it. */
export function clearPages(): void {
  for (const page of pages) {
    page.data.fill(0);
    page.version++;
    page.patches = [{ seq: page.version, x: 0, y: 0, w: PAGE_SIZE, h: PAGE_SIZE }];
  }
}

/** Texture-cache key for a dynamic page (parallel to `textureCacheKey`). */
export function dynamicPageTextureId(page: number): string {
  return `weasel-dyn-sdf-page-${page}`;
}

// Per-GL-cache upload progress: last page version each cache has seen.
// WeakMap-keyed so disposed renderers don't pin anything.
const uploadedVersions = new WeakMap<GlyphTextureSink, Map<number, number>>();

/** Bring `cache`'s copy of page `pageIndex` up to date: full R8 upload the
 *  first time, `texSubImage2D` patches after. Returns false if the page
 *  doesn't exist yet. */
export function syncDynamicPageTexture(cache: GlyphTextureSink, pageIndex: number): boolean {
  const page = pages[pageIndex];
  if (!page) return false;
  const id = dynamicPageTextureId(pageIndex);
  let seen = uploadedVersions.get(cache);
  if (!seen) {
    seen = new Map();
    uploadedVersions.set(cache, seen);
  }
  if (!cache.has(id)) {
    cache.uploadR8(id, PAGE_SIZE, PAGE_SIZE, page.data);
    seen.set(pageIndex, page.version);
    return true;
  }
  const last = seen.get(pageIndex) ?? 0;
  if (last >= page.version) return true;
  for (const patch of page.patches) {
    if (patch.seq <= last) continue;
    const tight = new Uint8Array(patch.w * patch.h);
    for (let row = 0; row < patch.h; row++) {
      const src = (patch.y + row) * PAGE_SIZE + patch.x;
      tight.set(page.data.subarray(src, src + patch.w), row * patch.w);
    }
    cache.subImageR8(id, patch.x, patch.y, patch.w, patch.h, tight);
  }
  seen.set(pageIndex, page.version);
  return true;
}

/** @internal test seam — inspect CPU-side pages. */
export function _getPagesForTests(): readonly DynamicPage[] {
  return pages;
}

/** @internal test seam — forget every page. */
export function _resetPagesForTests(): void {
  pages = [];
}
