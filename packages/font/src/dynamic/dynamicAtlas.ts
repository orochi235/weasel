/**
 * DynamicGlyphAtlas — runtime single-channel SDF glyphs for canvas-sourced
 * (installed machine) fonts. TinySDF technique: canvas fillText at 48 px →
 * Euclidean distance transform → shelf-packed R8 pages (1024², max 4).
 *
 * Baked MSDF atlases always win: this tier only serves families registered
 * via `registerCanvasFont` that have no baked entry (see resolveFontVariant).
 *
 * Faces expose a BmFont-shaped `font` whose charMap grows as glyphs are
 * requested, so `layoutRuns` consumes them through the same code path as
 * baked atlases. A char's advance is valid immediately (measureText); its
 * atlas rect fills in when the bake lands (width 0 / page -1 until then, so
 * layout advances the pen but emits no quad).
 */

import type { BmFont, BmFontChar } from '../FontAtlas';
import type { GlyphTextureSink } from '../textureSink';
// `fallback.ts` imports nothing, so this edge cannot close a cycle; keep it
// that way. (registerFont.ts imports both this module and fallback.ts.)
import { getFontFallbackPolicy } from '../fallback';
import { ShelfPacker } from './shelfPack';
import { alphaToSdf } from './distanceTransform';
import {
  createCanvasRasterizer, BAKE_SIZE,
  type GlyphRasterizer, type RasterizedGlyph,
} from './glyphRasterizer';

export const PAGE_SIZE = 1024;
export const MAX_PAGES = 4;
export const SDF_RADIUS = 8;
export const SDF_CUTOFF = 0.5;
export const DEFAULT_BAKE_BUDGET = 16;

export interface DynamicFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** BmFont-shaped view consumed by layoutRuns; charMap grows lazily. */
  font: BmFont;
  /** Char record for `cp`, measured on first request (advance always valid
   *  immediately; atlas rect fills in when the bake lands). */
  requestGlyph(cp: number): BmFontChar;
}

interface DynamicPage {
  data: Uint8Array;
  /** Bumps on every glyph blit; each blit appends a patch with seq = version. */
  version: number;
  patches: { seq: number; x: number; y: number; w: number; h: number }[];
}

interface PendingBake { char: BmFontChar; raster: RasterizedGlyph; }

const canvasFamilies = new Set<string>();
// Enrollment provenance. A family the `'canvas'` fallback policy enrolled on
// its own is only canvas-served while that policy is in force; one a consumer
// named via registerCanvasFont outranks every policy. Tracked here rather
// than in fallback.ts so the two sets can only ever be mutated together —
// every register / unregister / reset path is in this file.
const autoEnrolledFamilies = new Set<string>();
let faces = new Map<string, DynamicFace>();
let pages: DynamicPage[] = [];
let packer = new ShelfPacker(PAGE_SIZE, MAX_PAGES);
let pending: PendingBake[] = [];
let flushScheduled = false;
let budget = DEFAULT_BAKE_BUDGET;
const subscribers = new Set<() => void>();
let rasterizer: GlyphRasterizer | null = null;

function getRasterizer(): GlyphRasterizer {
  if (!rasterizer) rasterizer = createCanvasRasterizer();
  return rasterizer;
}

/** Mark `family` as canvas-sourced: when no baked atlas covers it,
 *  resolveFontVariant serves it from this dynamic atlas. */
export function registerCanvasFont(family: string): void {
  canvasFamilies.add(family);
  // An explicit call promotes a previously auto-enrolled family for good.
  autoEnrolledFamilies.delete(family);
}

/**
 * Will `family` be served by the dynamic canvas-SDF tier *right now*?
 *
 * Service, not membership — the answer depends on the fallback policy in
 * force and can change without any enrollment call:
 *   - explicitly enrolled via `registerCanvasFont` → `true` under every
 *     policy; a consumer naming a family outranks the policy.
 *   - auto-enrolled by the `'canvas'` policy → `true` only while that policy
 *     is still in force. The enrollment lapses rather than being discarded,
 *     so returning to `'canvas'` makes it `true` again.
 *   - never enrolled → `false`, including under `'canvas'` (that policy
 *     enrolls lazily, on the first miss).
 *
 * The membership reading would answer `true` for an auto-enrolled family
 * under `'substitute'` / `'none'`, where nothing routes to this tier — a
 * caller predicting what renders would be told the opposite of the truth.
 * Mirrors `listFonts`, which reports the baked registry alone for the same
 * reason: "enrolled" is not "will render".
 */
export function isCanvasFont(family: string): boolean {
  if (!canvasFamilies.has(family)) return false;
  return !autoEnrolledFamilies.has(family) || getFontFallbackPolicy() === 'canvas';
}

/**
 * @internal Enroll `family` on behalf of the `'canvas'` fallback policy.
 * Distinct from `registerCanvasFont` only in provenance: the enrollment
 * lapses (see `isExplicitCanvasFont`) if the policy later changes.
 */
export function autoEnrollCanvasFont(family: string): void {
  if (canvasFamilies.has(family) && !autoEnrolledFamilies.has(family)) return;
  canvasFamilies.add(family);
  autoEnrolledFamilies.add(family);
}

/**
 * @internal Enrolled by a consumer's own `registerCanvasFont` call rather than
 * by the `'canvas'` policy. Only these are served by the dynamic tier
 * regardless of the policy in force; an auto-enrolled family falls back to
 * whatever the current policy says once that policy is no longer `'canvas'`.
 */
export function isExplicitCanvasFont(family: string): boolean {
  return canvasFamilies.has(family) && !autoEnrolledFamilies.has(family);
}

/** Remove a canvas family. Its faces are dropped; already-baked glyph
 *  pixels stay in their pages (no eviction in v1). */
export function unregisterCanvasFont(family: string): void {
  canvasFamilies.delete(family);
  autoEnrolledFamilies.delete(family);
  for (const key of [...faces.keys()]) {
    if (faces.get(key)!.family === family) faces.delete(key);
  }
}

/**
 * Internal resolver helper — not part of the public barrel; consumers go
 * through registerCanvasFont + resolveFontVariant.
 */
export function getDynamicFace(
  family: string, weight: number, style: 'normal' | 'italic',
): DynamicFace {
  const key = `${family}|${weight}|${style}`;
  const existing = faces.get(key);
  if (existing) return existing;

  const r = getRasterizer();
  const metrics = r.faceMetrics(family, weight, style);
  const base = Math.round(metrics.ascent);
  const font: BmFont = {
    info: { face: family, size: BAKE_SIZE },
    common: {
      lineHeight: Math.round(metrics.ascent + metrics.descent),
      base,
      scaleW: PAGE_SIZE,
      scaleH: PAGE_SIZE,
    },
    chars: [],
    kernings: [], // no kerning in v1 (measured-pair kerning is future work)
    charMap: new Map(),
    kerningMap: new Map(),
  };

  const face: DynamicFace = {
    family, weight, style, font,
    requestGlyph(cp: number): BmFontChar {
      const cached = font.charMap.get(cp);
      if (cached) return cached;
      const raster = r.rasterize(family, weight, style, cp);
      const char: BmFontChar = {
        id: cp, x: 0, y: 0, width: 0, height: 0,
        xoffset: raster.left,
        yoffset: base - raster.top,
        xadvance: raster.advance,
        page: -1,
      };
      font.charMap.set(cp, char);
      font.chars.push(char);
      if (raster.width === 0 || raster.height === 0) {
        char.page = 0; // blank glyph (space): nothing to bake
        return char;
      }
      if (budget > 0) {
        budget--;
        bake(char, raster);
      } else {
        pending.push({ char, raster });
        scheduleFlush();
      }
      return char;
    },
  };
  faces.set(key, face);
  return face;
}

function bake(char: BmFontChar, raster: RasterizedGlyph): void {
  const spot = packer.alloc(raster.width, raster.height);
  if (!spot) return; // pages full — packer warned once; glyph stays invisible
  const sdf = alphaToSdf(raster.alpha, raster.width, raster.height, SDF_RADIUS, SDF_CUTOFF);
  while (pages.length <= spot.page) {
    pages.push({ data: new Uint8Array(PAGE_SIZE * PAGE_SIZE), version: 0, patches: [] });
  }
  const page = pages[spot.page];
  for (let row = 0; row < raster.height; row++) {
    page.data.set(
      sdf.subarray(row * raster.width, (row + 1) * raster.width),
      (spot.y + row) * PAGE_SIZE + spot.x,
    );
  }
  page.version++;
  page.patches.push({ seq: page.version, x: spot.x, y: spot.y, w: raster.width, h: raster.height });
  char.x = spot.x;
  char.y = spot.y;
  char.width = raster.width;
  char.height = raster.height;
  char.page = spot.page;
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(flushPending, 0);
}

function flushPending(): void {
  flushScheduled = false;
  let n = 0;
  while (pending.length > 0 && n < DEFAULT_BAKE_BUDGET) {
    const job = pending.shift()!;
    if (job.char.page !== -1) continue; // already baked
    bake(job.char, job.raster);
    n++;
  }
  if (pending.length > 0) scheduleFlush();
  for (const cb of subscribers) cb();
}

/** Subscribe to deferred-bake completion (fires after each flush batch).
 *  `<SceneCanvas>` subscribes and requests a redraw, mirroring
 *  `subscribeImageReady`. Returns an unsubscribe. */
export function subscribeGlyphReady(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Reset the per-frame synchronous bake budget. Called by
 *  `WeaselRenderer.render()` at frame start; the headless
 *  `renderSceneToPixels` path passes Infinity so print never defers. */
export function resetBakeBudget(n: number = DEFAULT_BAKE_BUDGET): void {
  budget = n;
}

/* ------------------------------------------------------------------ */
/* GPU sync                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Test seams                                                          */
/* ------------------------------------------------------------------ */

/** @internal test seam — inject a fake rasterizer (jsdom has no canvas
 *  metrics). Pass null to restore the lazy default. */
export function __setGlyphRasterizerForTests(r: GlyphRasterizer | null): void {
  rasterizer = r;
}

/** @internal test seam — inspect CPU-side pages. */
export function _getPagesForTests(): readonly DynamicPage[] {
  return pages;
}

/** @internal test seam — clear all dynamic-font state. */
export function _resetDynamicFontsForTests(): void {
  canvasFamilies.clear();
  autoEnrolledFamilies.clear();
  faces = new Map();
  pages = [];
  packer = new ShelfPacker(PAGE_SIZE, MAX_PAGES);
  pending = [];
  flushScheduled = false;
  budget = DEFAULT_BAKE_BUDGET;
  subscribers.clear();
  rasterizer = null;
}
