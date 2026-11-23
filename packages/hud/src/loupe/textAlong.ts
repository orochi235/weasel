import { textCommandFromRuns } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { mat3, type TrackShape } from '@weasel-js/geom';
import { solidFill } from '@weasel-js/paint';
import { textWidth } from '../menu/textWidth';
import { haloOf } from './halo';

/** A piece of an along-text label set at its own size: `scale` times the label's `fontSize`, centered on the same
 *  line, as a sign a face draws small (Oswald's `×`) is brought up to its neighbors. */
export interface AlongRun { text: string; scale?: number }

/** What `textAlong` sets: the text, its type, and its color. */
export interface AlongText {
  text: string | readonly AlongRun[];
  fontFamily: string;
  fontSize: number;
  color: string;
  /** Px of track to leave before the text, as for an icon set ahead of it. */
  lead?: number;
  /** Edge each character in this color, so it reads over whatever is behind it. */
  halo?: string;
}

/** Where along `track` a run of `width` px centered at fraction `mid` starts, and which way it reads: against the
 *  track where the track runs leftward there, so the text stays upright. */
export function runAlong(track: TrackShape, mid: number, width: number): { at: (px: number) => number; flip: boolean } {
  const flip = track.at(mid).tangent.x < 0;
  const center = mid * track.length;
  const sign = flip ? -1 : 1;
  return { at: (px) => (center + sign * (px - width / 2)) / track.length, flip };
}

/** A run of one size, `dx` from the left of the piece it is part of. */
interface Sized { text: string; size: number; w: number; dx: number }

/** A piece of text and where it stands: centered on the transform's origin, read along its x axis. */
interface Placed { runs: Sized[]; w: number; transform: ReturnType<typeof mat3.fromAffine> }

/** `text`'s runs laid end to end at their sizes, and their width. */
function sizedOf(text: AlongText['text'], t: AlongText): { runs: Sized[]; w: number } {
  const runs: Sized[] = [];
  let x = 0;
  for (const r of typeof text === 'string' ? [{ text }] : text) {
    const size = t.fontSize * (r.scale ?? 1);
    const w = textWidth(r.text, size, t.fontFamily);
    runs.push({ text: r.text, size, w, dx: x });
    x += w;
  }
  return { runs, w: x };
}

/** The transform standing text on `track` at fraction `f`, turned to its heading there, read upright. */
function standingAt(track: TrackShape, f: number, flip: boolean): Placed['transform'] {
  const { point, tangent } = track.at(f);
  const turn = Math.atan2(tangent.y, tangent.x) + (flip ? Math.PI : 0);
  const cos = Math.cos(turn), sin = Math.sin(turn);
  return mat3.fromAffine([cos, sin, -sin, cos, point.x, point.y]);
}

/** The commands for `placed`: every halo before any fill, so one piece's edge never covers its neighbor. */
function drawPlaced(placed: readonly Placed[], t: AlongText): DrawCommand[] {
  const pass = (paint: (p: Placed) => DrawCommand[]): DrawCommand[] =>
    placed.map((p) => ({ kind: 'group', transform: p.transform, children: paint(p) }));
  const glyph = ({ runs, w }: Placed, dx: number, dy: number, color: string): DrawCommand[] => runs.map((r) =>
    textCommandFromRuns(dx - w / 2 + r.dx, dy - r.size / 2, [{ text: r.text, fill: solidFill(color) }],
      { fontFamily: t.fontFamily, fontSize: r.size }, undefined, r.size, 'center'));
  const { halo } = t;
  const out = halo ? pass((p) => haloOf((dx, dy, c) => glyph(p, dx, dy, c), halo)) : [];
  out.push(...pass((p) => glyph(p, 0, 0, t.color)));
  return out;
}

/**
 * `text` set along `track`, centered at fraction `mid`: each character stands on the track turned to its heading
 * there, so a label follows an arc rather than crossing it. Upright wherever the track runs, read left to right.
 */
export function textAlong(track: TrackShape, mid: number, t: AlongText): DrawCommand[] {
  const lead = t.lead ?? 0;
  const runs = typeof t.text === 'string' ? [{ text: t.text }] : t.text;
  const letters = runs.flatMap((r) => [...r.text].map((ch) => sizedOf([{ text: ch, scale: r.scale }], t)));
  const run = runAlong(track, mid, lead + letters.reduce((a, l) => a + l.w, 0));
  const placed: Placed[] = [];
  let x = lead;
  for (const l of letters) {
    placed.push({ ...l, transform: standingAt(track, run.at(x + l.w / 2), run.flip) });
    x += l.w;
  }
  return drawPlaced(placed, t);
}

/** `text` stood on `track` at fraction `f` in one piece, turned to the heading there: for a label too short to bend,
 *  whose letters are measured too roughly to set one by one. */
export function textAt(track: TrackShape, f: number, t: AlongText): DrawCommand[] {
  const flip = track.at(f).tangent.x < 0;
  return drawPlaced([{ ...sizedOf(t.text, t), transform: standingAt(track, f, flip) }], t);
}
