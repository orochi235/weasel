/**
 * Bidi analysis for a text with hard line breaks in it.
 *
 * UAX #9 is defined per paragraph, and a hard break ends one: embeddings and
 * overrides close there, and the next paragraph resolves its neutrals — and,
 * under `'auto'`, its direction — from its own characters. The engine's
 * `analyze` takes exactly one paragraph, so this splits the code points at the
 * breaks, analyzes each stretch, and answers a line's reorder against whichever
 * stretch the line sits in.
 */
import type { BidiAnalysis, BidiReordering, BidiResolver } from './bidiSeam';

interface Paragraph {
  start: number;
  end: number;
  analysis: BidiAnalysis;
}

/** Visual order for the line `[from, to)`, as positions in the whole text. */
export type LineReorder = (from: number, to: number) => BidiReordering;

/**
 * Analyze `codePoints` paragraph by paragraph. `isBreak` marks the hard breaks,
 * which belong to no paragraph. The returned function reorders one line, which
 * must lie within a single paragraph — true of any line a wrap produces.
 */
export function analyzeParagraphs(
  engine: BidiResolver,
  codePoints: readonly number[],
  isBreak: (index: number) => boolean,
  direction: 'ltr' | 'rtl' | 'auto',
): LineReorder {
  const paragraphs: Paragraph[] = [];
  let start = 0;
  for (let i = 0; i <= codePoints.length; i++) {
    if (i < codePoints.length && !isBreak(i)) continue;
    if (i > start) {
      paragraphs.push({ start, end: i, analysis: engine.analyze(codePoints.slice(start, i), direction) });
    }
    start = i + 1;
  }

  return (from, to) => {
    let lo = 0;
    let hi = paragraphs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (paragraphs[mid].end <= from) lo = mid + 1;
      else hi = mid;
    }
    const p = paragraphs[lo];
    if (p === undefined || from < p.start || to > p.end) return { order: [], levels: [] };
    const r = engine.reorder(p.analysis, from - p.start, to - p.start);
    return { order: r.order.map((i) => i + p.start), levels: r.levels };
  };
}
