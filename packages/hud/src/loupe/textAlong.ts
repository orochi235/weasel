import { textCommandFromRuns } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { mat3, type TrackShape } from '@weasel-js/geom';
import { solidFill } from '@weasel-js/paint';
import { textWidth } from '../menu/textWidth';

/** What `textAlong` sets: the text, its type, and its color. */
export interface AlongText {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  /** Px of track to leave before the text, as for an icon set ahead of it. */
  lead?: number;
}

/** Where along `track` a run of `width` px centered at fraction `mid` starts, and which way it reads: against the
 *  track where the track runs leftward there, so the text stays upright. */
export function runAlong(track: TrackShape, mid: number, width: number): { at: (px: number) => number; flip: boolean } {
  const flip = track.at(mid).tangent.x < 0;
  const center = mid * track.length;
  const sign = flip ? -1 : 1;
  return { at: (px) => (center + sign * (px - width / 2)) / track.length, flip };
}

/**
 * `text` set along `track`, centered at fraction `mid`: each character stands on the track turned to its heading
 * there, so a label follows an arc rather than crossing it. Upright wherever the track runs, read left to right.
 */
export function textAlong(track: TrackShape, mid: number, t: AlongText): DrawCommand[] {
  const lead = t.lead ?? 0;
  const widths = [...t.text].map((ch) => textWidth(ch, t.fontSize, t.fontFamily));
  const run = runAlong(track, mid, lead + widths.reduce((a, b) => a + b, 0));
  const font = { fontFamily: t.fontFamily, fontSize: t.fontSize };
  const out: DrawCommand[] = [];
  let x = lead;
  [...t.text].forEach((ch, i) => {
    const w = widths[i]!;
    const { point, tangent } = track.at(run.at(x + w / 2));
    const turn = Math.atan2(tangent.y, tangent.x) + (run.flip ? Math.PI : 0);
    const cos = Math.cos(turn), sin = Math.sin(turn);
    out.push({
      kind: 'group',
      transform: mat3.fromAffine([cos, sin, -sin, cos, point.x, point.y]),
      children: [textCommandFromRuns(-w / 2, -t.fontSize / 2, [{ text: ch, fill: solidFill(t.color) }], font, undefined, t.fontSize, 'center')],
    });
    x += w;
  });
  return out;
}
