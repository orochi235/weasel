/**
 * A `rotate` list read as glyph turns. Each value turns one glyph about its
 * pen, counting through the `<text>` and every `<tspan>`; a glyph past the end
 * of a list takes its last value. A glyph takes its own `<tspan>`'s value where
 * that has a list, and the `<text>`'s where it has none. The runs carry the
 * turn as `rotate`, one run per stretch of glyphs at one angle.
 */
import type { StyledRun } from '@weasel-js/core';
import { collapses } from './glyphShifts';

/** `el`'s own `rotate` list, empty where it has none or white space SVG
 *  collapses would move the glyphs its values name, which is reported. */
export function turnsOf(el: Element, onWarn: (m: string) => void): number[] {
  const raw = el.getAttribute('rotate')?.trim();
  if (!raw) return [];
  const list = raw.split(/[\s,]+/).map(Number);
  if (list.some((v) => !Number.isFinite(v))) {
    onWarn(`<${el.tagName.toLowerCase()} rotate="${raw}"> is not read: it is not a list of numbers`);
    return [];
  }
  if (list.some((v) => v !== list[0]) && collapses(el)) {
    onWarn(`<${el.tagName.toLowerCase()} rotate="${raw}"> is not read: its text has white space SVG collapses,`
      + ' which moves the glyphs the list names');
    return [];
  }
  return list;
}

/** Glyph `i`'s value in `list`, its last for a glyph past its end. */
const valueAt = (list: readonly number[], i: number): number | undefined =>
  list.length === 0 ? undefined : list[Math.min(i, list.length - 1)];

/** A `<text>`'s `rotate` list, handed out to the runs of its children in order. */
export class TextTurns {
  private readonly list: number[];
  private at = 0;

  constructor(text: Element, onWarn: (m: string) => void) {
    this.list = turnsOf(text, onWarn);
  }

  /** The turns of the next `n` glyphs, the `own` list of their `<tspan>`
   *  winning where it has one. */
  take(n: number, own: readonly number[] = []): number[] {
    const out = Array.from({ length: n }, (_, i) => valueAt(own, i) ?? valueAt(this.list, this.at + i) ?? 0);
    this.at += n;
    return out;
  }
}

/** Turn the runs at the end of `line` that hold the last `turns.length`
 *  glyphs, glyph `i` by `turns[i]` degrees, splitting them where the angle
 *  changes. */
export function turnRuns(line: StyledRun[], turns: readonly number[]): void {
  if (turns.every((t) => t === 0)) return;
  let start = line.length;
  let n = turns.length;
  while (n > 0 && start > 0) n -= Array.from(line[--start].text).length;
  const out: StyledRun[] = [];
  // Where the first run reached holds glyphs before the ones turned, they keep their angle.
  let g = Math.min(n, 0);
  for (const run of line.slice(start)) {
    if (run.text === '') {
      out.push(run);
      continue;
    }
    const { rotate: own, ...upright } = run;
    let last: number | undefined;
    for (const glyph of Array.from(run.text)) {
      const turn = g < 0 ? own ?? 0 : turns[g] ?? 0;
      g++;
      if (turn === last) out[out.length - 1].text += glyph;
      else out.push(turn === 0 ? { ...upright, text: glyph } : { ...upright, text: glyph, rotate: turn });
      last = turn;
    }
  }
  line.splice(start, line.length - start, ...out);
}
