import { registeredBidi } from '@weasel-js/core';

/** One stretch of a typed line that reads one way: code points `[lo, hi)`, starting at `x`. */
interface Run { lo: number; hi: number; rtl: boolean; x: number; w: number }

/**
 * A line of typed text set against `right`, in the visual order the renderer
 * lays it out in: with a bidi engine registered, a right-to-left stretch reads
 * from its right end. Offsets are code points into the text.
 */
export interface TypedLine {
  /** Where the line's ink starts. */
  left: number;
  /** The caret's x at offset `i`: after the character before it, or before the first. */
  xAt(i: number): number;
  /** The spans `[from, to)` covers on screen, one per stretch it crosses, left to right. */
  spans(from: number, to: number): Array<[number, number]>;
}

/** Stretches of `order` (visual positions) that are logically contiguous at one level. */
function runsOf(order: readonly number[], levels: ArrayLike<number>): Array<Omit<Run, 'x' | 'w'>> {
  const out: Array<Omit<Run, 'x' | 'w'>> = [];
  let prev = -2;
  for (const p of order) {
    const rtl = levels[p]! % 2 === 1;
    const last = out[out.length - 1];
    if (last !== undefined && last.rtl === rtl && p === (rtl ? prev - 1 : prev + 1)) {
      if (rtl) last.lo = p; else last.hi = p + 1;
    } else {
      out.push({ lo: p, hi: p + 1, rtl });
    }
    prev = p;
  }
  return out;
}

/** `text` laid out ending at `right`, each stretch `measure`d as a whole. */
export function typedLine(text: string, right: number, measure: (text: string) => number): TypedLine {
  const chars = Array.from(text);
  const engine = registeredBidi();
  const slice = (lo: number, hi: number) => chars.slice(lo, hi).join('');
  let visual: Array<Omit<Run, 'x' | 'w'>>;
  if (engine === null || chars.length === 0) {
    visual = [{ lo: 0, hi: chars.length, rtl: false }];
  } else {
    const { order, levels } = engine.reorder(engine.analyze(chars.map((c) => c.codePointAt(0)!), 'auto'), 0, chars.length);
    visual = runsOf(order, levels);
  }
  const widths = visual.map((r) => measure(slice(r.lo, r.hi)));
  const left = right - widths.reduce((a, b) => a + b, 0);
  const runs: Run[] = [];
  let x = left;
  visual.forEach((r, i) => { runs.push({ ...r, x, w: widths[i]! }); x += widths[i]!; });
  /** The x of the edge of `r` that `i` code points into it, logically, leave behind. */
  const edge = (r: Run, i: number) => {
    const into = measure(slice(r.lo, i));
    return r.rtl ? r.x + r.w - into : r.x + into;
  };
  const holding = (c: number) => runs.find((r) => c >= r.lo && c < r.hi);
  return {
    left,
    xAt(i) {
      // A character the engine dropped (a formatting control) has no place; the caret takes the one before it.
      for (let c = i - 1; c >= 0; c--) {
        const r = holding(c);
        if (r !== undefined) return edge(r, c + 1);
      }
      for (let c = i; c < chars.length; c++) {
        const r = holding(c);
        if (r !== undefined) return edge(r, c);
      }
      return right;
    },
    spans(from, to) {
      const out: Array<[number, number]> = [];
      for (const r of runs) {
        const lo = Math.max(from, r.lo);
        const hi = Math.min(to, r.hi);
        if (lo >= hi) continue;
        const a = edge(r, lo);
        const b = edge(r, hi);
        out.push([Math.min(a, b), Math.max(a, b)]);
      }
      return out;
    },
  };
}
