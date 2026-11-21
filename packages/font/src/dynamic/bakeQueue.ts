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
 *  notify through `subscribeGlyphReady`. */
export const DEFAULT_BAKE_BUDGET = 16;

type Raster = RasterizedGlyph | RasterizedColorGlyph;
interface PendingBake { char: BmFontChar; raster: Raster; sharp: boolean; retried?: boolean }

/** Room on one set of pages, and whether that set is waiting to be emptied. */
interface Room {
  packer: ShelfPacker;
  /** False from an emptying of the pages until a frame asks for no new glyph
   *  with none waiting to bake: until what was on screen has baked again. */
  settled: boolean;
  /** Emptied since the frame began, so that frame's quiet says nothing of
   *  what has baked again. */
  emptied: boolean;
  reclaimScheduled: boolean;
}

const newRoom = (): Room => ({
  packer: new ShelfPacker(PAGE_SIZE, MAX_PAGES), settled: true, emptied: false, reclaimScheduled: false,
});
const emptiedRoom = (): Room => ({ ...newRoom(), settled: false, emptied: true });

let fieldRoom = newRoom();
let colorRoom = newRoom();
let sharpRoom = newRoom();
let pending: PendingBake[] = [];
let flushScheduled = false;
/** Every timer this queue has set and not yet seen fire, so a reset can clear them. */
const timers = new Set<ReturnType<typeof setTimeout>>();

function later(run: () => void): void {
  const id = setTimeout(() => {
    timers.delete(id);
    run();
  }, 0);
  timers.add(id);
}
let budget = DEFAULT_BAKE_BUDGET;
/** Glyphs measured since the frame began. */
let asked = 0;
/** Glyphs that found no room while their pages refilled after an emptying,
 *  kept so that asking for one again once the pages settle can empty them. */
let starved = new Map<BmFontChar, PendingBake>();
/** Set by an emptying a starved glyph asked for, and cleared by a newly
 *  measured glyph: one that starves again then waits for the text to change,
 *  so text needing more than the pages hold does not empty them every frame. */
let starvedRetry: 'idle' | 'emptying' | 'blocked' = 'idle';
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
  if (starvedRetry === 'blocked') starvedRetry = 'idle';
  if (raster.width === 0 || raster.height === 0) {
    char.page = 0; // blank glyph (space): nothing to bake
    return;
  }
  queueBake({ char, raster, sharp });
}

function queueBake(job: PendingBake): void {
  if (budget > 0) {
    budget--;
    bake(job.char, job.raster, job.sharp, job.retried);
  } else {
    pending.push(job);
    scheduleFlush();
  }
}

/**
 * Text asked again for `char`, a glyph with no rect. One that found no room
 * while the pages refilled is baked again once they have settled, which
 * empties them when it still finds none, so the text now on screen bakes into
 * the room that leaves.
 */
export function retryStarved(char: BmFontChar): void {
  const job = starved.get(char);
  if (!job || starvedRetry === 'blocked' || !roomOf(job).settled) return;
  starved.delete(char);
  asked++;
  queueBake({ ...job, retried: true });
}

function roomOf(job: PendingBake): Room {
  return job.sharp ? sharpRoom : 'rgba' in job.raster ? colorRoom : fieldRoom;
}

/** Abandon the bakes still waiting for any of `chars`. */
export function dropBakes(chars: ReadonlySet<BmFontChar>): void {
  pending = pending.filter((job) => !chars.has(job.char));
  for (const char of chars) starved.delete(char);
}

function bake(char: BmFontChar, raster: Raster, sharp: boolean, retried = false): void {
  const color = 'rgba' in raster;
  const room = roomOf({ char, raster, sharp });
  const spot = room.packer.alloc(raster.width, raster.height);
  if (!spot) {
    noRoom(room, { char, raster, sharp, retried }, sharp ? reclaimSharp : reclaim);
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
function noRoom(room: Room, job: PendingBake, empty: () => void): void {
  const { raster } = job;
  if (!room.packer.fits(raster.width, raster.height)) {
    warnOnce('weasel DynamicGlyphAtlas: a glyph is larger than a page and will not render.');
  } else if (!room.settled) {
    starved.set(job.char, job);
    if (starvedRetry === 'emptying') starvedRetry = 'blocked';
    // A sharp bake that finds no room leaves its glyph on a softer one, so it
    // goes unsaid.
    if (room === sharpRoom) return;
    warnOnce(
      `weasel DynamicGlyphAtlas: more glyphs are in use at once than its pages hold ` +
      `(${MAX_PAGES} × ${PAGE_SIZE}²); the rest will not render.`);
  } else if (!room.reclaimScheduled) {
    room.reclaimScheduled = true;
    if (job.retried) starvedRetry = 'emptying';
    // An emptying that ran first has already replaced this room.
    later(() => { if (roomOf(job) === room) empty(); });
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
  fieldRoom = emptiedRoom();
  colorRoom = emptiedRoom();
  sharpRoom = emptiedRoom();
  pending = [];
  starved = new Map();
  clearPages();
  forgetGlyphs();
  forgetSharp();
  notifyGlyphReady();
}

/** `reclaim` for the sharp color pages alone. Every glyph keeps its base bake
 *  and draws from that until a sharper one lands again. */
function reclaimSharp(): void {
  sharpRoom = emptiedRoom();
  pending = pending.filter((job) => !job.sharp);
  for (const [char, job] of starved) if (job.sharp) starved.delete(char);
  clearSharpPages();
  forgetSharp();
  notifyGlyphReady();
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  later(flushPending);
}

function flushPending(): void {
  flushScheduled = false;
  let n = 0;
  while (pending.length > 0 && n < DEFAULT_BAKE_BUDGET) {
    const job = pending.shift()!;
    if (job.char.page !== -1) continue; // already baked
    bake(job.char, job.raster, job.sharp, job.retried);
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
  const rooms = [fieldRoom, colorRoom, sharpRoom];
  const quiet = asked === 0 && pending.length === 0;
  if (quiet && starvedRetry === 'emptying' && !rooms.some((room) => room.emptied)) starvedRetry = 'idle';
  for (const room of rooms) {
    if (quiet && !room.emptied) room.settled = true;
    room.emptied = false;
  }
  asked = 0;
}

/** @internal test seam — forget every bake and all the room given out. */
export function _resetBakeQueueForTests(): void {
  for (const id of timers) clearTimeout(id);
  timers.clear();
  fieldRoom = newRoom();
  colorRoom = newRoom();
  sharpRoom = newRoom();
  pending = [];
  starved = new Map();
  starvedRetry = 'idle';
  flushScheduled = false;
  asked = 0;
  warned.clear();
  budget = DEFAULT_BAKE_BUDGET;
}
