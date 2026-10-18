/**
 * DynamicGlyphAtlas — runtime single-channel SDF glyphs for canvas-sourced
 * (installed machine) fonts. TinySDF technique: canvas fillText at 48 px →
 * Euclidean distance transform → shelf-packed R8 pages (1024², max 4). When
 * the pages fill they are emptied whole and the text on screen bakes again.
 *
 * Baked MSDF atlases always win: this tier only serves families registered
 * via `registerCanvasFont` that have no baked entry (see resolveFontVariant).
 *
 * Faces expose a BmFont-shaped `font` whose charMap grows as glyphs are
 * requested, so `layoutRuns` consumes them through the same code path as
 * baked atlases. A char's advance is valid immediately (measureText); its
 * atlas rect fills in when the bake lands (width 0 / page -1 until then, so
 * layout advances the pen but emits no quad).
 *
 * An emoji is the one glyph kept as the canvas drew it: `requestCluster`
 * rasterizes a whole grapheme cluster in its own colors onto a second set of
 * pages, RGBA, that fill and empty with the field pages, and bakes it again
 * larger for drawing past its size (`sharpColor.ts`).
 */

import type { FontStyle } from '../fontStyle';
import type { BmFont, BmFontChar } from '../FontAtlas';
// `fallback.ts` imports nothing, so this edge cannot close a cycle; keep it
// that way. (registerFont.ts imports both this module and fallback.ts.)
import { getFontFallbackPolicy } from '../fallback';
import { notifyGlyphReady, _clearGlyphReadySubscribers } from '../glyphReady';
import { PAGE_SIZE, MAX_PAGES, _resetPagesForTests } from './dynamicPages';
import { dropBakes, onPagesEmptied, requestBake, _resetBakeQueueForTests } from './bakeQueue';
import { familyKey, watchFontLoads } from './fontLoads';
import { createCanvasRasterizer, BAKE_SIZE, type GlyphRasterizer } from './glyphRasterizer';
import { addSharpSource, sharpBakesOf } from './sharpColor';

export { PAGE_SIZE, MAX_PAGES };
export {
  syncDynamicPageTexture, dynamicPageTextureId, syncColorPageTexture, colorPageTextureId,
  syncSharpColorPageTexture, sharpColorPageTextureId, _getPagesForTests,
} from './dynamicPages';
export { sharperColorGlyph, MAX_SHARP_LEVEL, type SharperColorGlyph } from './sharpColor';
export { SDF_RADIUS, SDF_CUTOFF, DEFAULT_BAKE_BUDGET, resetBakeBudget } from './bakeQueue';

/** A face whose glyphs are rasterized on demand into a shared atlas page, rather than shipped as a prebuilt one. */
export interface DynamicFace {
  family: string;
  weight: number;
  style: FontStyle;
  /** BmFont-shaped view consumed by layoutRuns; charMap grows lazily. */
  font: BmFont;
  /** Char record for `cp`, measured on first request (advance always valid
   *  immediately; atlas rect fills in when the bake lands). */
  requestGlyph(cp: number): BmFontChar;
  /**
   * The color glyph the platform draws for the grapheme cluster `text`,
   * measured on first request as `requestGlyph`'s is, or null when it draws
   * none. Its record is marked `color` and its rect is on a color page. It is
   * not in `font.charMap`, which holds one code point each.
   */
  requestCluster(text: string): BmFontChar | null;
}

interface Face extends DynamicFace {
  clusters: Map<string, BmFontChar | null>;
}

/** One family served by the dynamic canvas-SDF tier. See `listCanvasFonts`. */
export interface CanvasFontEntry {
  family: string;
  /** `'explicit'` — a `registerCanvasFont` call; `'auto'` — the `'canvas'`
   *  fallback policy enrolled it on a miss, and the enrollment lapses if
   *  that policy changes. */
  enrollment: 'explicit' | 'auto';
}

const canvasFamilies = new Set<string>();
// Enrollment provenance; see `isCanvasFont`. Tracked here rather than in
// fallback.ts so the two sets can only ever be mutated together.
const autoEnrolledFamilies = new Set<string>();
let faces = new Map<string, Face>();
let rasterizer: GlyphRasterizer | null = null;
let stopWatchingLoads: (() => void) | null = null;

function forgetGlyphs(face: Face): void {
  face.font.charMap.clear();
  face.font.chars.length = 0;
  face.clusters.clear();
}

onPagesEmptied(() => {
  for (const face of faces.values()) forgetGlyphs(face);
});

function getRasterizer(): GlyphRasterizer {
  if (!rasterizer) rasterizer = createCanvasRasterizer();
  return rasterizer;
}

/** Mark `family` as canvas-sourced: when no baked atlas covers it,
 *  resolveFontVariant serves it from this dynamic atlas. */
export function registerCanvasFont(family: string): void {
  if (isExplicitCanvasFont(family)) return;
  canvasFamilies.add(family);
  // An explicit call promotes a previously auto-enrolled family for good.
  autoEnrolledFamilies.delete(family);
  notifyGlyphReady();
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
 */
export function isCanvasFont(family: string): boolean {
  if (!canvasFamilies.has(family)) return false;
  return !autoEnrolledFamilies.has(family) || getFontFallbackPolicy() === 'canvas';
}

/**
 * Every family the dynamic canvas-SDF tier will serve *right now* — the
 * enumeration companion to `isCanvasFont`, which answers one family at a
 * time. Same "service, not membership" rule: an auto-enrolled family appears
 * only while the `'canvas'` policy is in force. `listFonts` reports the baked
 * registry alone.
 *
 * `enrollment` distinguishes a consumer's explicit `registerCanvasFont` from
 * a lazy enrollment the policy made on a miss; both render identically, but
 * only the explicit one survives a policy change.
 */
export function listCanvasFonts(): readonly CanvasFontEntry[] {
  const out: CanvasFontEntry[] = [];
  for (const family of canvasFamilies) {
    if (!isCanvasFont(family)) continue;
    out.push({ family, enrollment: autoEnrolledFamilies.has(family) ? 'auto' : 'explicit' });
  }
  return out.sort((a, b) => a.family.localeCompare(b.family));
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

/** Remove a canvas family. Its faces are dropped; the room its glyphs took
 *  comes back when the pages next fill and are emptied. */
export function unregisterCanvasFont(family: string): void {
  if (!canvasFamilies.has(family)) return;
  canvasFamilies.delete(family);
  autoEnrolledFamilies.delete(family);
  for (const key of [...faces.keys()]) {
    if (faces.get(key)!.family === family) faces.delete(key);
  }
  notifyGlyphReady();
}

/**
 * Internal resolver helper — not part of the public barrel; consumers go
 * through registerCanvasFont + resolveFontVariant.
 */
export function getDynamicFace(
  family: string, weight: number, style: FontStyle,
): DynamicFace {
  const key = `${family}|${weight}|${style}`;
  const existing = faces.get(key);
  if (existing) return existing;

  const r = getRasterizer();
  const font: BmFont = {
    info: { face: family, size: BAKE_SIZE },
    common: { lineHeight: 0, base: 0, scaleW: PAGE_SIZE, scaleH: PAGE_SIZE },
    chars: [],
    kernings: [], // no kerning in v1 (measured-pair kerning is future work)
    charMap: new Map(),
    kerningMap: new Map(),
  };

  /** An unbaked record for a glyph the rasterizer placed at `left`, `top`. */
  const record = (id: number, raster: { left: number; top: number; advance: number }): BmFontChar => ({
    id, x: 0, y: 0, width: 0, height: 0,
    xoffset: raster.left,
    yoffset: font.common.base - raster.top,
    xadvance: raster.advance,
    page: -1,
  });
  const clusters = new Map<string, BmFontChar | null>();

  const face: Face = {
    family, weight, style, font, clusters,
    requestGlyph(cp: number): BmFontChar {
      const cached = font.charMap.get(cp);
      if (cached) return cached;
      const raster = r.rasterize(family, weight, style, cp);
      const char = record(cp, raster);
      font.charMap.set(cp, char);
      font.chars.push(char);
      requestBake(char, raster);
      return char;
    },
    requestCluster(text: string): BmFontChar | null {
      const cached = clusters.get(text);
      if (cached !== undefined) return cached;
      const raster = r.rasterizeColor?.(family, weight, style, text) ?? null;
      const char: BmFontChar | null = raster && { ...record(text.codePointAt(0)!, raster), color: true };
      clusters.set(text, char);
      if (char && raster) {
        requestBake(char, raster);
        addSharpSource(char, font.common.base, (size) => r.rasterizeColor?.(family, weight, style, text, size) ?? null);
      }
      return char;
    },
  };
  measureFace(face);
  faces.set(key, face);
  stopWatchingLoads ??= watchFontLoads(refreshFamilies);
  return face;
}

/** Read `face`'s metrics off the canvas, and forget the glyphs measured before. */
function measureFace(face: Face): void {
  const { font } = face;
  const metrics = getRasterizer().faceMetrics(face.family, face.weight, face.style);
  font.common.lineHeight = Math.round(metrics.ascent + metrics.descent);
  font.common.base = Math.round(metrics.ascent);
  // Unrounded, unlike `common`: layout places the baseline from these.
  font.faceMetrics = { ascent: metrics.ascent / BAKE_SIZE, descent: metrics.descent / BAKE_SIZE };
  forgetGlyphs(face);
}

/**
 * Measure `family`'s canvas faces again, or every family's when none is named.
 *
 * The tier keeps each face's metrics and each glyph's shape and advance from
 * the first time it is asked. A web font that finishes loading after that is
 * picked up from `document.fonts` without this call; a face the document
 * never announces, one loaded before it was added, needs it.
 */
export function refreshCanvasFont(family?: string): void {
  refreshFamilies(family === undefined ? null : [family]);
}

function refreshFamilies(families: readonly string[] | null): void {
  const keys = families && new Set(families.map(familyKey));
  const dropped = new Set<BmFontChar>();
  let measured = 0;
  for (const face of faces.values()) {
    if (keys && !face.family.split(',').some((name) => keys.has(familyKey(name)))) continue;
    for (const char of face.font.chars) dropped.add(char);
    for (const char of face.clusters.values()) {
      if (!char) continue;
      dropped.add(char);
      for (const sharp of sharpBakesOf(char)) dropped.add(sharp);
    }
    measureFace(face);
    measured++;
  }
  if (measured === 0) return;
  // Their rects stay taken until the pages next fill and are emptied.
  dropBakes(dropped);
  notifyGlyphReady();
}

/** @internal test seam — inject a fake rasterizer (jsdom has no canvas
 *  metrics). Pass null to restore the lazy default. */
export function __setGlyphRasterizerForTests(r: GlyphRasterizer | null): void {
  rasterizer = r;
}

/** @internal test seam — clear all dynamic-font state. */
export function _resetDynamicFontsForTests(): void {
  canvasFamilies.clear();
  autoEnrolledFamilies.clear();
  faces = new Map();
  _resetPagesForTests();
  _resetBakeQueueForTests();
  stopWatchingLoads?.();
  stopWatchingLoads = null;
  _clearGlyphReadySubscribers();
  rasterizer = null;
}
