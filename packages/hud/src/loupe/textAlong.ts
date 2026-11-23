import { textCommandFromRuns } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { mat3, type TrackShape } from '@weasel-js/geom';
import { solidFill } from '@weasel-js/paint';
import { textWidth } from '../menu/textWidth';
import { haloOf } from './halo';

/** What `textAlong` sets: the text, its type, and its color. */
export interface AlongText {
  text: string;
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

/** A piece of text and where it stands: centered on the transform's origin, read along its x axis. */
interface Placed { text: string; w: number; transform: ReturnType<typeof mat3.fromAffine> }

/** The transform standing text on `track` at fraction `f`, turned to its heading there, read upright. */
function standingAt(track: TrackShape, f: number, flip: boolean): Placed['transform'] {
  const { point, tangent } = track.at(f);
  const turn = Math.atan2(tangent.y, tangent.x) + (flip ? Math.PI : 0);
  const cos = Math.cos(turn), sin = Math.sin(turn);
  return mat3.fromAffine([cos, sin, -sin, cos, point.x, point.y]);
}

/** The commands for `placed`: every halo before any fill, so one piece's edge never covers its neighbor. */
function drawPlaced(placed: readonly Placed[], t: AlongText): DrawCommand[] {
  const font = { fontFamily: t.fontFamily, fontSize: t.fontSize };
  const pass = (paint: (p: Placed) => DrawCommand[]): DrawCommand[] =>
    placed.map((p) => ({ kind: 'group', transform: p.transform, children: paint(p) }));
  const glyph = ({ text, w }: Placed, dx: number, dy: number, color: string): DrawCommand[] => [
    textCommandFromRuns(dx - w / 2, dy - t.fontSize / 2, [{ text, fill: solidFill(color) }], font, undefined, t.fontSize, 'center'),
  ];
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
  const widths = [...t.text].map((ch) => textWidth(ch, t.fontSize, t.fontFamily));
  const run = runAlong(track, mid, lead + widths.reduce((a, b) => a + b, 0));
  const placed: Placed[] = [];
  let x = lead;
  [...t.text].forEach((ch, i) => {
    const w = widths[i]!;
    placed.push({ text: ch, w, transform: standingAt(track, run.at(x + w / 2), run.flip) });
    x += w;
  });
  return drawPlaced(placed, t);
}

/** `text` stood on `track` at fraction `f` in one piece, turned to the heading there: for a label too short to bend,
 *  whose letters are measured too roughly to set one by one. */
export function textAt(track: TrackShape, f: number, t: AlongText): DrawCommand[] {
  const flip = track.at(f).tangent.x < 0;
  return drawPlaced([{ text: t.text, w: textWidth(t.text, t.fontSize, t.fontFamily), transform: standingAt(track, f, flip) }], t);
}
