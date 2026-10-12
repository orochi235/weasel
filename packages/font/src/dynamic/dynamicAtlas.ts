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
 */

import type { FontStyle } from '../fontStyle';
import type { BmFont, BmFontChar } from '../FontAtlas';
// `fallback.ts` imports nothing, so this edge cannot close a cycle; keep it
// that way. (registerFont.ts imports both this module and fallback.ts.)
import { getFontFallbackPolicy } from '../fallback';
import { notifyGlyphReady, _clearGlyphReadySubscribers } from '../glyphReady';
import { ShelfPacker } from './shelfPack';
import {
  PAGE_SIZE, MAX_PAGES, blitToPage, clearPages, _resetPagesForTests,
} from './dynamicPages';
import { alphaToSdf } from './distanceTransform';
import {
  createCanvasRasterizer, BAKE_SIZE,
  type GlyphRasterizer, type RasterizedGlyph,
} from './glyphRasterizer';

export { PAGE_SIZE, MAX_PAGES };
export { syncDynamicPageTexture, dynamicPageTextureId, _getPagesForTests } from './dynamicPages';
export const SDF_RADIUS = 8;
export const SDF_CUTOFF = 0.5;
/** How many glyphs the dynamic atlas will rasterize synchronously before
 *  deferring the rest to a later flush. Caps the frame cost of text that
 *  suddenly needs many new glyphs; the leftovers arrive a tick later and
 *  notify through `onGlyphReady`. */
export const DEFAULT_BAKE_BUDGET = 16;

export interface DynamicFace {
  family: string;
  weight: number;
  style: FontStyle;
  /** BmFont-shaped view consumed by layoutRuns; charMap grows lazily. */
  font: BmFont;
  /** Char record for `cp`, measured on first request (advance always valid
   *  immediately; atlas rect fills in when the bake lands). */
  requestGlyph(cp: number): BmFontChar;
}

interface PendingBake { char: BmFontChar; raster: RasterizedGlyph; }

/** One family served by the dynamic canvas-SDF tier. See `listCanvasFonts`. */
export interface CanvasFontEntry {
  family: string;
  /** `'explicit'` — a `registerCanvasFont` call; `'auto'` — the `'canvas'`
   *  fallback policy enrolled it on a miss, and the enrollment lapses if
   *  that policy changes. */
  enrollment: 'explicit' | 'auto';
}

const canvasFamilies = new Set<string>();
// Enrollment provenance. A family the `'canvas'` fallback policy enrolled on
// its own is only canvas-served while that policy is in force; one a consumer
// named via registerCanvasFont outranks every policy. Tracked here rather
// than in fallback.ts so the two sets can only ever be mutated together —
// every register / unregister / reset path is in this file.
const autoEnrolledFamilies = new Set<string>();
let faces = new Map<string, DynamicFace>();
let packer = new ShelfPacker(PAGE_SIZE, MAX_PAGES);
let pending: PendingBake[] = [];
let flushScheduled = false;
let budget = DEFAULT_BAKE_BUDGET;
let rasterizer: GlyphRasterizer | null = null;
/** Glyphs measured since the frame began. */
let asked = 0;
/** False from an emptying of the pages until a frame asks for no new glyph
 *  with none waiting to bake: until what was on screen has baked again. */
let settled = true;
let reclaimScheduled = false;
const warned = new Set<string>();

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
 * Every family the dynamic canvas-SDF tier will serve *right now* — the
 * enumeration companion to `isCanvasFont`, which answers one family at a
 * time. Same "service, not membership" rule: an auto-enrolled family appears
 * only while the `'canvas'` policy is in force.
 *
 * Exists so a consumer can offer these families in a font picker.
 * `listFonts` reports the baked registry alone, so without this the only
 * ways to present canvas-served families were to hard-code a list beside the
 * `registerCanvasFont` calls or to omit them — a UI inventing its own answer
 * about what will render.
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
    // Unrounded, unlike `common`: layout places the baseline from these.
    faceMetrics: { ascent: metrics.ascent / BAKE_SIZE, descent: metrics.descent / BAKE_SIZE },
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
      asked++;
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
  if (!spot) {
    noRoom(raster);
    return;
  }
  const sdf = alphaToSdf(raster.alpha, raster.width, raster.height, SDF_RADIUS, SDF_CUTOFF);
  blitToPage(spot.page, spot.x, spot.y, raster.width, raster.height, sdf);
  char.x = spot.x;
  char.y = spot.y;
  char.width = raster.width;
  char.height = raster.height;
  char.page = spot.page;
}

/** A glyph found no room, and stays invisible for the frame that asked. */
function noRoom(raster: RasterizedGlyph): void {
  if (!packer.fits(raster.width, raster.height)) {
    warnOnce('weasel DynamicGlyphAtlas: a glyph is larger than a page and will not render.');
  } else if (!settled) {
    warnOnce(
      `weasel DynamicGlyphAtlas: more glyphs are in use at once than its pages hold ` +
      `(${MAX_PAGES} × ${PAGE_SIZE}²); the rest will not render.`);
  } else if (!reclaimScheduled) {
    reclaimScheduled = true;
    setTimeout(reclaim, 0);
  }
}

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * Empty every page and forget every glyph, so the text on screen bakes again
 * into the room that leaves. Run off a timer, never from `bake`: a frame part
 * drawn has already placed quads on the rects this gives away.
 */
function reclaim(): void {
  reclaimScheduled = false;
  settled = false;
  packer = new ShelfPacker(PAGE_SIZE, MAX_PAGES);
  pending = [];
  clearPages();
  for (const face of faces.values()) {
    face.font.charMap.clear();
    face.font.chars.length = 0;
  }
  notifyGlyphReady();
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
  notifyGlyphReady();
}

/** Reset the per-frame synchronous bake budget. Called by
 *  `WeaselRenderer.render()` at frame start; the headless
 *  `renderSceneToPixels` path passes Infinity so print never defers. */
export function resetBakeBudget(n: number = DEFAULT_BAKE_BUDGET): void {
  budget = n;
  if (asked === 0 && pending.length === 0) settled = true;
  asked = 0;
}

/* ------------------------------------------------------------------ */
/* Test seams                                                          */
/* ------------------------------------------------------------------ */

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
  packer = new ShelfPacker(PAGE_SIZE, MAX_PAGES);
  pending = [];
  flushScheduled = false;
  asked = 0;
  settled = true;
  reclaimScheduled = false;
  warned.clear();
  budget = DEFAULT_BAKE_BUDGET;
  _clearGlyphReadySubscribers();
  rasterizer = null;
}
