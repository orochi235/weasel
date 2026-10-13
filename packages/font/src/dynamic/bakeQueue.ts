/**
 * Baking measured glyphs into the dynamic atlas's pages: a few a frame, the
 * rest on later ticks, and every page emptied whole when one set fills.
 */

import type { BmFontChar } from '../FontAtlas';
import { notifyGlyphBaked, notifyGlyphReady } from '../glyphReady';
import { ShelfPacker } from './shelfPack';
import {
  PAGE_SIZE, MAX_PAGES, blitToPage, blitToColorPage, clearPages,
} from './dynamicPages';
import { alphaToSdf } from './distanceTransform';
import type { RasterizedColorGlyph, RasterizedGlyph } from './glyphRasterizer';

export const SDF_RADIUS = 8;
export const SDF_CUTOFF = 0.5;
/** How many glyphs the dynamic atlas will rasterize synchronously before
 *  deferring the rest to a later flush. Caps the frame cost of text that
 *  suddenly needs many new glyphs; the leftovers arrive a tick later and
 *  notify through `onGlyphReady`. */
export const DEFAULT_BAKE_BUDGET = 16;

type Raster = RasterizedGlyph | RasterizedColorGlyph;
interface PendingBake { char: BmFontChar; raster: Raster; }

const newPacker = (): ShelfPacker => new ShelfPacker(PAGE_SIZE, MAX_PAGES);

let fieldPacker = newPacker();
let colorPacker = newPacker();
let pending: PendingBake[] = [];
let flushScheduled = false;
let budget = DEFAULT_BAKE_BUDGET;
/** Glyphs measured since the frame began. */
let asked = 0;
/** False from an emptying of the pages until a frame asks for no new glyph
 *  with none waiting to bake: until what was on screen has baked again. */
let settled = true;
let reclaimScheduled = false;
let forgetGlyphs: () => void = () => {};
const warned = new Set<string>();

/** Name what forgets every glyph record when the pages are emptied. */
export function onPagesEmptied(forget: () => void): void {
  forgetGlyphs = forget;
}

/**
 * Give a freshly measured glyph its atlas rect: now while the frame has bakes
 * left, else on a later tick. `char` keeps page -1 until it lands.
 */
export function requestBake(char: BmFontChar, raster: Raster): void {
  asked++;
  if (raster.width === 0 || raster.height === 0) {
    char.page = 0; // blank glyph (space): nothing to bake
    return;
  }
  if (budget > 0) {
    budget--;
    bake(char, raster);
  } else {
    pending.push({ char, raster });
    scheduleFlush();
  }
}

/** Abandon the bakes still waiting for any of `chars`. */
export function dropBakes(chars: ReadonlySet<BmFontChar>): void {
  pending = pending.filter((job) => !chars.has(job.char));
}

function bake(char: BmFontChar, raster: Raster): void {
  const color = 'rgba' in raster;
  const packer = color ? colorPacker : fieldPacker;
  const spot = packer.alloc(raster.width, raster.height);
  if (!spot) {
    noRoom(packer, raster);
    return;
  }
  if (color) {
    blitToColorPage(spot.page, spot.x, spot.y, raster.width, raster.height, raster.rgba);
  } else {
    const sdf = alphaToSdf(raster.alpha, raster.width, raster.height, SDF_RADIUS, SDF_CUTOFF);
    blitToPage(spot.page, spot.x, spot.y, raster.width, raster.height, sdf);
  }
  char.x = spot.x;
  char.y = spot.y;
  char.width = raster.width;
  char.height = raster.height;
  char.page = spot.page;
}

/** A glyph found no room, and stays invisible for the frame that asked. */
function noRoom(packer: ShelfPacker, raster: Raster): void {
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
  fieldPacker = newPacker();
  colorPacker = newPacker();
  pending = [];
  clearPages();
  forgetGlyphs();
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
  notifyGlyphBaked();
}

/** Reset the per-frame synchronous bake budget. Called by
 *  `WeaselRenderer.render()` at frame start; the headless
 *  `renderSceneToPixels` path passes Infinity so print never defers. */
export function resetBakeBudget(n: number = DEFAULT_BAKE_BUDGET): void {
  budget = n;
  if (asked === 0 && pending.length === 0) settled = true;
  asked = 0;
}

/** @internal test seam — forget every bake and all the room given out. */
export function _resetBakeQueueForTests(): void {
  fieldPacker = newPacker();
  colorPacker = newPacker();
  pending = [];
  flushScheduled = false;
  asked = 0;
  settled = true;
  reclaimScheduled = false;
  warned.clear();
  budget = DEFAULT_BAKE_BUDGET;
}
