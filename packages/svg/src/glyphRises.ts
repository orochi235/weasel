/**
 * Vertical glyph moves read as baseline shift. A `dy`, or a `y` that opens no
 * new line, moves a glyph and every glyph after it off the line; the runs
 * carry that as `baselineShift`, one run per stretch of glyphs at one height,
 * until a new line or another move puts the pen somewhere else.
 */
import { resolveRunFace, resolveTextStyle, scriptMetricsFor, type StyledRun, type TextStyle } from '@weasel-js/core';
import { collapses, readList } from './glyphShifts';
import { type LineTracker, writtenByWeasel } from './tspanLines';

/** The `y` and `dy` values over a stretch of glyphs: glyph `i` goes to
 *  `y[i]` where it has one, and then down by `dy[i]`. */
export interface Moves { y: readonly (number | undefined)[]; dy: readonly number[] }

export const NO_MOVES: Moves = { y: [], dy: [] };

/** `el`'s own `y` and `dy` lists, cut to their first values where collapsing
 *  white space would move the glyphs the rest name. */
export function movesOf(el: Element, onWarn: (m: string) => void): Moves {
  const y = readList(el, 'y', onWarn);
  const dy = readList(el, 'dy', onWarn);
  const perGlyph = y.length > 1 || dy.slice(1).some((v) => v !== 0);
  if (perGlyph && collapses(el)) {
    const named = (['y', 'dy'] as const).filter((n) => el.hasAttribute(n)).map((n) => `${n}="${el.getAttribute(n)}"`);
    onWarn(`<${el.tagName.toLowerCase()} ${named.join(' ')}> is read only to its first value: its text has white space`
      + ' SVG collapses, which moves the glyphs the list names');
    return { y: y.slice(0, 1), dy: dy.slice(0, 1) };
  }
  return { y, dy };
}

/**
 * A `<text>`'s `y` and `dy` lists, handed out to the runs of its children in
 * order: each value moves one glyph, counting through the text and every
 * `<tspan>`. The first `y` places the text. The first `dy` moves the first
 * glyph, except in text weasel wrote, which puts the half leading there.
 */
export class TextMoves {
  private readonly moves: Moves;
  private at = 0;

  constructor(text: Element, onWarn: (m: string) => void) {
    const { y, dy } = movesOf(text, onWarn);
    this.moves = { y: [undefined, ...y.slice(1)], dy: [writtenByWeasel(text) ? 0 : dy[0] ?? 0, ...dy.slice(1)] };
  }

  /** The values over the next `n` glyphs. */
  take(n: number): Moves {
    const out = { y: this.moves.y.slice(this.at, this.at + n), dy: this.moves.dy.slice(this.at, this.at + n) };
    this.at += n;
    return out;
  }
}

/**
 * How far above the line each of `glyphs` sits, in user units, moving the
 * pen glyph by glyph: by `own` values where it has them, and otherwise by the
 * text's, `inherited`. `placed` says the first glyph's move was already made,
 * as `LineTracker.startsLine` makes a tspan's.
 */
export function risesOver(
  glyphs: readonly string[], own: Moves, inherited: Moves, tracker: LineTracker, placed: boolean,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    if (i > 0 || !placed) {
      tracker.move(i < own.y.length ? own.y[i] : inherited.y[i], (i < own.dy.length ? own.dy[i] : inherited.dy[i]) ?? 0);
    }
    tracker.land(glyphs[i]!);
    out.push(tracker.rise);
  }
  return out;
}

/** The rise a run already has, in ems: its own, or its script's. */
function ownShift(run: StyledRun, style: TextStyle): number {
  if (run.baselineShift != null) return run.baselineShift;
  if (!run.script) return 0;
  const face = resolveRunFace(run, resolveTextStyle(style));
  return scriptMetricsFor(face.fontFamily, face.fontWeight, face.fontStyle)[run.script].shift;
}

/**
 * Raise the runs at the end of `line` that hold the last `rises.length`
 * glyphs, glyph `i` by `rises[i]` user units on top of any rise it had, as a
 * `baselineShift` in ems of `fontSize`, the text's.
 */
export function raiseRuns(line: StyledRun[], rises: readonly number[], fontSize: number, style: TextStyle): void {
  if (!(fontSize > 0) || rises.every((r) => Math.abs(r) < 1e-9)) return;
  let start = line.length;
  for (let n = rises.length; n > 0 && start > 0;) n -= Array.from(line[--start].text).length;
  const out: StyledRun[] = [];
  let g = 0;
  for (const run of line.slice(start)) {
    if (run.text === '') {
      out.push(run);
      continue;
    }
    let last: number | undefined;
    for (const glyph of Array.from(run.text)) {
      const em = Math.round(((rises[g++] ?? 0) / fontSize) * 1e6) / 1e6;
      if (em === last) out[out.length - 1].text += glyph;
      else out.push(em === 0 ? { ...run, text: glyph } : { ...run, text: glyph, baselineShift: ownShift(run, style) + em });
      last = em;
    }
  }
  line.splice(start, line.length - start, ...out);
}
