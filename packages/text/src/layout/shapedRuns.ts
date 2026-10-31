/**
 * A run's shaping, laid over its code points.
 *
 * Layout keeps one entry per code point, which carets, wrapping and bidi all
 * index. A shaper answers in clusters instead, any number of glyphs for any
 * number of code points: so the code point opening a cluster draws all of its
 * glyphs, set from that one pen. A cluster spanning several grapheme clusters
 * (a ligature of two letters) splits its advance evenly across them, so a
 * caret can stop inside it; each grapheme's first code point takes a share and
 * the rest take none. Right to left the opening code point is drawn rightmost,
 * so its glyphs shift left by the other shares to land where the shaper put
 * them.
 */
import type { ResolveResult } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import type { ShapedCluster, ShapedGlyph, TextShaper } from './shaperSeam';
import { shapeableBytes } from './shaperRegistry';
import { graphemeEnds } from '../measure/graphemes';

/** What one code point of a shaped run takes. */
export interface ShapedSlot {
  cluster: ShapedCluster;
  /** Ems. */
  advance: number;
}

/** What a code point inside a cluster another one draws holds. */
const NOTHING_DRAWN: ShapedCluster = Object.freeze({ d: null, key: '', glyphs: Object.freeze([]), rtl: false, text: '' });

/** A code point inside a cluster another one draws, opening no grapheme. */
const COVERED: ShapedSlot = Object.freeze({ cluster: NOTHING_DRAWN, advance: 0 });

/** Slots by UTF-16 offset in the run's text: set at every code point a shaped
 *  cluster covers, absent where the code point is left to be found on its own. */
export type ShapedRun = readonly (ShapedSlot | undefined)[];

/** One shaping's slots, for as long as the shaper holds the shaping. */
const slotsOf = new WeakMap<readonly ShapedGlyph[], ShapedRun>();

const fmt = (v: number): string => String(Math.round(v * 1e5) / 1e5);

/**
 * `run`'s shaping by `shaper` in the face `resolved` landed on, or null when
 * it is not shaped: no shaper, or a face with no bytes a shaper reads.
 *
 * A cluster holding `.notdef` is left out, so its code points go to the
 * fallback ladder as unshaped text does rather than drawing the face's box.
 */
export function shapeRun(
  run: ResolvedRun, resolved: ResolveResult, shaper: TextShaper | null,
): ShapedRun | null {
  if (shaper === null) return null;
  const face = shapeableBytes(resolved);
  if (face === null) return null;
  const glyphs = shaper.shape(face, run.text, run.fontFeatures, run.lang);
  let slots = slotsOf.get(glyphs);
  if (slots) return slots;
  slots = slotsFor(shaper, face, run.text, glyphs);
  slotsOf.set(glyphs, slots);
  return slots;
}

function slotsFor(
  shaper: TextShaper, face: ArrayBuffer, text: string, glyphs: readonly ShapedGlyph[],
): ShapedRun {
  const slots: (ShapedSlot | undefined)[] = new Array(text.length);
  const ends = graphemeEnds(text);
  let g = 0;
  let i = 0;
  while (i < glyphs.length) {
    const start = glyphs[i].cluster;
    let j = i;
    while (j < glyphs.length && glyphs[j].cluster === start) j++;
    const end = j < glyphs.length ? glyphs[j].cluster : text.length;
    // The graphemes opening inside the cluster, past its own first code point.
    while (g < ends.length && ends[g] <= start) g++;
    let inner = 0;
    for (let k = g; k < ends.length && ends[k] < end; k++) inner++;
    if (!holdsNotdef(glyphs, i, j)) {
      const total = advanceOf(glyphs, i, j);
      const share = total / (inner + 1);
      const shift = glyphs[i].rtl ? share - total : 0;
      slots[start] = clusterSlot(shaper, face, glyphs, i, j, text.slice(start, end), shift, share);
      const opens = share === 0 ? COVERED : { cluster: NOTHING_DRAWN, advance: share };
      for (let at = start + 1, k = g; at < end; at++) {
        const opening = k < ends.length && ends[k] === at;
        if (opening) k++;
        slots[at] = opening ? opens : COVERED;
      }
    }
    i = j;
  }
  return slots;
}

function advanceOf(glyphs: readonly ShapedGlyph[], from: number, to: number): number {
  let sum = 0;
  for (let k = from; k < to; k++) sum += glyphs[k].advance;
  return sum;
}

function holdsNotdef(glyphs: readonly ShapedGlyph[], from: number, to: number): boolean {
  for (let k = from; k < to; k++) if (glyphs[k].gid === 0) return true;
  return false;
}

/** Glyphs `[from, to)`, one cluster, set from one pen moved by `shift` ems,
 *  its opening code point taking `advance` of the cluster's width. */
function clusterSlot(
  shaper: TextShaper, face: ArrayBuffer, glyphs: readonly ShapedGlyph[], from: number, to: number, text: string,
  shift: number, advance: number,
): ShapedSlot {
  const placed: ShapedCluster['glyphs'][number][] = [];
  let pen = shift;
  let d = '';
  let key = '';
  for (let k = from; k < to; k++) {
    const g = glyphs[k];
    const x = pen + g.dx, y = g.dy;
    placed.push({ gid: g.gid, x, y, advance: g.advance });
    d += shaper.glyphD(face, g.gid, x, y) ?? '';
    key += `${k === from ? '' : ';'}${g.gid}${x === 0 && y === 0 ? '' : `@${fmt(x)},${fmt(y)}`}`;
    pen += g.advance;
  }
  return { cluster: { d: d.length > 0 ? d : null, key, glyphs: placed, rtl: glyphs[from].rtl, text }, advance };
}
