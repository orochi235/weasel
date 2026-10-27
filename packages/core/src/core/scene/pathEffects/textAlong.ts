/**
 * Text along a path: a source's items — a text node's grapheme clusters, or a
 * whole shape as one item — laid end to end along a path, each turned to it.
 */
import {
  boundsOfPath, multiply, pathShape, placeAlongRun, rotate, runLength, trackRun, transformPath, translate,
  type Affine, type Path, type RunAlign, type RunPlace, type TrackSide,
} from '@weasel-js/geom';
import type { DerivedPart } from '../derivedParts';
import type { EffectItem, EffectSource, PathEffectOptions } from './source';
import { bandParts, type LaidItem } from './textAlongBands';

/**
 * Text (or any shape) laid along a path, item by item. Its sources are `[text, path]`. Only the text's first laid line
 * follows the path; a color glyph keeps its advance and paints nothing. An item's bands — underline, strikethrough and
 * overline — join their alike neighbors' and bend with the path as one ribbon, while the glyphs stay rigid.
 * On an open path an item whose middle falls past either end is not drawn; on a closed one the text wraps past the
 * seam, and an item a whole lap on from the first item's start is not drawn.
 */
export interface TextAlongEffect extends PathEffectOptions {
  kind: 'textAlong';
  /** Which part of the text sits at `start`. Default `'start'`. */
  align?: RunAlign;
  /** Where the text sits, as a fraction 0..1 of the path's length from its first point. Default 0. */
  start?: number;
  /** How far the anchor line sits off the path, toward the glyphs' up, in world units. Default 0. */
  shift?: number;
  /** What sits on the path: the glyphs' baseline, or (`'center'`) their x-height middle. Default `'baseline'`. */
  anchor?: 'baseline' | 'center';
  /** Text longer than its room is cut at the path's end (`'clip'`), or has the gaps between items squeezed until it
   *  fits (`'fit'`). Default `'clip'`. */
  overflow?: 'clip' | 'fit';
  /** Which side of the path the glyphs stand on; see `TrackSide`. Default `'auto'`, whichever reads upright. Turned over,
   *  the text keeps the stretch of path it had, and on an open path drops whichever letters fall off it. */
  side?: TrackSide;
}

const LEAD: Record<RunAlign, number> = { start: 0, center: 0.5, end: 1 };

/** The parts `items` paint laid along `path` as `effect` says; `[]` when there is nothing to lay or nowhere to lay it. */
export function textAlongParts(effect: TextAlongEffect, items: readonly EffectItem[], path: Path): DerivedPart[] {
  const shape = pathShape(path);
  if (shape === null || !(shape.length > 0) || items.length === 0) return [];
  const L = shape.length;
  const closed = shape.closed;
  const lengths = items.map((it) => it.length);
  const k = LEAD[effect.align ?? 'start'];
  const at = clamp01(effect.start ?? 0) * L;
  const gap = effect.overflow === 'fit' ? fitGap(lengths, roomAt(at, L, k, closed)) : 0;
  const total = runLength(lengths, gap);
  const c = at + (0.5 - k) * total;
  const about = closed ? ((c / L) % 1 + 1) % 1 : clamp01(c / L);
  const run = trackRun(shape, 0, 1, { side: effect.side ?? 'auto', about });
  const shift = finiteOr(effect.shift, 0);
  const places = placeAlongRun(run, lengths, { gap, align: 'center', at: run.reversed ? L - c : c, shift, wrap: closed });
  const center = effect.anchor === 'center';
  const out: DerivedPart[] = [];
  const laid: (LaidItem | null)[] = [];
  const firstStart = places[0]!.center - lengths[0]! / 2;
  places.forEach((place, i) => {
    // By center (SVG textPath's rule), not by RunPlace.clipped, which judges by extent.
    if (dropped(place, closed ? firstStart : null, L)) {
      laid.push(null);
      return;
    }
    const item = items[i]!;
    const lift = center ? item.middle : 0;
    const m = itemFrame(place, item.length, lift);
    for (const part of item.parts) out.push({ ...part, path: transformPath(part.path, m) });
    laid.push({ item, start: place.center - item.length / 2, lift });
  });
  if (items.some((it) => it.bands !== undefined && it.bands.length > 0)) out.push(...bandParts(laid, run, shift));
  return out;
}

/** `source`'s whole outline as one item: its bounds' left at x = 0 and their vertical middle on the anchor line. */
export function wholeItem(source: EffectSource): EffectItem {
  const b = boundsOfPath(source.world);
  return {
    length: b.width,
    middle: 0,
    parts: [{
      path: transformPath(source.world, translate(-b.x, -(b.y + b.height / 2))),
      fill: source.fill,
      stroke: source.stroke,
    }],
  };
}

/** SVG `textPath`'s rule: an item is not drawn once its middle is past an open path's ends, or on a closed path a whole
 *  lap or more on from the first item's start. Judged within a hair of rounding. */
function dropped(place: RunPlace, firstStart: number | null, L: number): boolean {
  const hair = 1e-9 * Math.max(1, L);
  if (firstStart !== null) return place.center - firstStart >= L - hair;
  return place.center < -hair || place.center > L + hair;
}

/** How much path the text has before it runs off, from `at`, with `k` of it laid back behind `at`. */
function roomAt(at: number, L: number, k: number, closed: boolean): number {
  if (closed) return L;
  return k === 0 ? L - at : k === 1 ? at : 2 * Math.min(at, L - at);
}

/** The gap that makes `lengths` fill `room`, or 0 when they fit already. Never so negative that an item's step back
 *  from the one before it (its length plus the gap) goes below zero, so items keep their order in too short a room. */
function fitGap(lengths: readonly number[], room: number): number {
  const total = runLength(lengths, 0);
  if (!(total > room) || lengths.length < 2) return 0;
  let floor = -Infinity;
  for (let i = 1; i < lengths.length; i++) floor = Math.max(floor, -(lengths[i - 1]! + lengths[i]!) / 2);
  return Math.max((room - total) / (lengths.length - 1), floor);
}

/** Item frame to world: its middle on `place`, turned to it, its anchor line `lift` above y = 0 brought onto the path. */
function itemFrame(place: RunPlace, length: number, lift: number): Affine {
  const turn = multiply(rotate((place.angle * Math.PI) / 180), translate(-length / 2, lift));
  return multiply(translate(place.point.x, place.point.y), turn);
}

const clamp01 = (v: number): number => (v > 1 ? 1 : v > 0 ? v : 0);
const finiteOr = (v: number | undefined, d: number): number => (v !== undefined && Number.isFinite(v) ? v : d);
