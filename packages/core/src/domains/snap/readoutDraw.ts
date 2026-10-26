/**
 * The screen-space drawing the snap readout and the guides overlay share:
 * ticked segments, number pills, and the glyph-and-label of a point mark.
 */
import { PATH_L, PATH_M, pathFromD, rectPath, type PolygonPath, type PathSnapKind } from '@weasel-js/geom';
import { textCommand, textCommandFromRuns, type CommandStroke, type DrawCommand } from '@weasel-js/renderer';
import { pathSnapGlyph } from 'domains/paths/pathSnap/glyphs';

const PILL_FONT = { fontSize: 10 };
// No text measurer in a layer: a 10px digit advances about 6px.
const PILL_CHAR_W = 6;
const PILL_H = 14;
const PILL_PAD_X = 4;

/** A straight segment from (x0, y0) to (x1, y1), with a tick of length `t`
 *  across each end. Screen px. */
export function tickedSegment(x0: number, y0: number, x1: number, y1: number, t: number): PolygonPath {
  const h = t / 2;
  const len = Math.hypot(x1 - x0, y1 - y0);
  // Across the segment: the pixel axes when it runs along one, else its normal.
  const [nx, ny] = x0 === x1 ? [1, 0] : y0 === y1 || len === 0 ? [0, 1] : [-(y1 - y0) / len, (x1 - x0) / len];
  const ends = t <= 0 ? [] : [
    x0 - nx * h, y0 - ny * h, x0 + nx * h, y0 + ny * h,
    x1 - nx * h, y1 - ny * h, x1 + nx * h, y1 + ny * h,
  ];
  const coords = [x0, y0, x1, y1, ...ends];
  const commands: number[] = [];
  for (let i = 0; i < coords.length; i += 4) commands.push(PATH_M, PATH_L);
  return {
    kind: 'polygon',
    commands: new Uint8Array(commands),
    coords: new Float32Array(coords),
    fillRule: 'nonzero',
  };
}

/** `text` on a filled pill centered at (cx, cy), in white on `color`. */
export function pillCommands(cx: number, cy: number, text: string, color: string): DrawCommand[] {
  const w = text.length * PILL_CHAR_W + PILL_PAD_X * 2;
  const left = cx - w / 2;
  const top = cy - PILL_H / 2;
  return [
    { kind: 'path', path: rectPath(left, top, w, PILL_H), fill: { paint: { kind: 'solid', color } } },
    textCommandFromRuns(left + PILL_PAD_X, top + 2, [{ text, fill: { paint: { kind: 'solid', color: '#fff' } } }], PILL_FONT),
  ];
}

/** A ticked segment between two screen points, with `label` on a pill at its middle. */
export function measuredSegmentCommands(
  x0: number, y0: number, x1: number, y1: number,
  ticks: number, stroke: CommandStroke, label: string | null, color: string,
): DrawCommand[] {
  const out: DrawCommand[] = [{ kind: 'path', path: tickedSegment(x0, y0, x1, y1, ticks), stroke }];
  if (label !== null) out.push(...pillCommands((x0 + x1) / 2, (y0 + y1) / 2, label, color));
  return out;
}

/** The glyph for `glyph` on (x, y), `r` from center to edge, with `label`
 *  above and to its right. An unknown glyph name draws as `anchor`. */
export function glyphCommands(
  glyph: string, x: number, y: number, label: string | undefined, color: string, r = 5, fontSize = 11,
): DrawCommand[] {
  const d = pathSnapGlyph(glyph as PathSnapKind, x, y, r) ?? pathSnapGlyph('anchor', x, y, r);
  const out: DrawCommand[] = [
    { kind: 'path', path: pathFromD(d), stroke: { paint: { color }, width: 1.5 } },
  ];
  if (label) {
    out.push(textCommand(x + r + 3, y - r - fontSize - 2, label, { fontSize }, undefined, undefined, undefined, {
      fill: { paint: { color } },
    }));
  }
  return out;
}
