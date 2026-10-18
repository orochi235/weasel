/**
 * Baking measured glyphs into the dynamic atlas's pages: a few a frame, the
 * rest on later ticks, and every page emptied whole when the field or color
 * set fills. The sharp color set, larger bakes of color glyphs, empties alone.
 */

import type { BmFontChar } from '../FontAtlas';
import { notifyGlyphBaked, notifyGlyphReady } from '../glyphReady';
import { ShelfPacker } from './shelfPack';
import {
  PAGE_SIZE, MAX_PAGES, blitToPage, blitToColorPage, blitToSharpColorPage, clearPages, clearSharpPages,
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
interface PendingBake { char: BmFontChar; raster: Raster; sharp: boolean; }

/** Room on one set of pages, and whether that set is waiting to be emptied. */
interface Room {
  packer: ShelfPacker;
  /** False from an emptying of the pages until a frame asks for no new glyph
   *  with none waiting to bake: until what was on screen has baked again. */
  settled: boolean;
  reclaimScheduled: boolean;
}

const newRoom = (): Room => ({ packer: new ShelfPacker(PAGE_SIZE, MAX_PAGES), settled: true, reclaimScheduled: false });

let fieldRoom = newRoom();
let colorRoom = newRoom();
let sharpRoom = newRoom();
let pending: PendingBake[] = [];
let flushScheduled = false;
let budget = DEFAULT_BAKE_BUDGET;
/** Glyphs measured since the frame began. */
let asked = 0;
let forgetGlyphs: () => void = () => {};
let forgetSharp: () => void = () => {};
const warned = new Set<string>();

/** Name what forgets every glyph record when the pages are emptied. */
export function onPagesEmptied(forget: () => void): void {
  forgetGlyphs = forget;
}

/** Name what forgets every sharp color bake when its pages are emptied, alone
 *  or with the rest. */
export function onSharpPagesEmptied(forget: () => void): void {
  forgetSharp = forget;
}

/**
 * Give a freshly measured glyph its atlas rect: now while the frame has bakes
 * left, else on a later tick. `char` keeps page -1 until it lands.
 */
export function requestBake(char: BmFontChar, raster: Raster, sharp = false): void {
  asked++;
  if (raster.width === 0 || raster.height === 0) {
    char.page = 0; // blank glyph (space): nothing to bake
    return;
  }
  if (budget > 0) {
    budget--;
    bake(char, raster, sharp);
  } else {
    pending.push({ char, raster, sharp });
    scheduleFlush();
  }
}

/** Abandon the bakes still waiting for any of `chars`. */
export function dropBakes(chars: ReadonlySet<BmFontChar>): void {
  pending = pending.filter((job) => !chars.has(job.char));
}

function bake(char: BmFontChar, raster: Raster, sharp: boolean): void {
  const color = 'rgba' in raster;
  const room = sharp ? sharpRoom : color ? colorRoom : fieldRoom;
  const spot = room.packer.alloc(raster.width, raster.height);
  if (!spot) {
    noRoom(room, raster, sharp ? reclaimSharp : reclaim);
    return;
  }
  if (color && sharp) {
    blitToSharpColorPage(spot.page, spot.x, spot.y, raster.width, raster.height, raster.rgba);
  } else if (color) {
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
function noRoom(room: Room, raster: Raster, empty: () => void): void {
  if (!room.packer.fits(raster.width, raster.height)) {
    warnOnce('weasel DynamicGlyphAtlas: a glyph is larger than a page and will not render.');
  } else if (!room.settled) {
    // A sharp bake that finds no room leaves its glyph on a softer one, so it
    // goes unsaid.
    if (room === sharpRoom) return;
    warnOnce(
      `weasel DynamicGlyphAtlas: more glyphs are in use at once than its pages hold ` +
      `(${MAX_PAGES} × ${PAGE_SIZE}²); the rest will not render.`);
  } else if (!room.reclaimScheduled) {
    room.reclaimScheduled = true;
    setTimeout(empty, 0);
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
  fieldRoom = { ...newRoom(), settled: false };
  colorRoom = { ...newRoom(), settled: false };
  sharpRoom = { ...newRoom(), settled: false };
  pending = [];
  clearPages();
  forgetGlyphs();
  forgetSharp();
  notifyGlyphReady();
}

/** `reclaim` for the sharp color pages alone. Every glyph keeps its base bake
 *  and draws from that until a sharper one lands again. */
function reclaimSharp(): void {
  sharpRoom = { ...newRoom(), settled: false };
  pending = pending.filter((job) => !job.sharp);
  clearSharpPages();
  forgetSharp();
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
    bake(job.char, job.raster, job.sharp);
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
  if (asked === 0 && pending.length === 0) {
    fieldRoom.settled = true;
    colorRoom.settled = true;
    sharpRoom.settled = true;
  }
  asked = 0;
}

/** @internal test seam — forget every bake and all the room given out. */
export function _resetBakeQueueForTests(): void {
  fieldRoom = newRoom();
  colorRoom = newRoom();
  sharpRoom = newRoom();
  pending = [];
  flushScheduled = false;
  asked = 0;
  warned.clear();
  budget = DEFAULT_BAKE_BUDGET;
}
