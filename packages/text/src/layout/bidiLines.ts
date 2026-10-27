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

/** A text's paragraphs, analyzed. */
export interface AnalyzedParagraphs {
  /** Visual order for the line `[from, to)`, as positions in the whole text. */
  reorder(from: number, to: number): BidiReordering;
  /** The level the paragraph holding position `at` reads at; 0 for a position
   *  in none, which is a hard break or a blank line. */
  baseLevel(at: number): number;
}

/**
 * Analyze `codePoints` paragraph by paragraph. `isBreak` marks the hard breaks,
 * which belong to no paragraph. `reorder` takes one line, which must lie within
 * a single paragraph — true of any line a wrap produces.
 */
export function analyzeParagraphs(
  engine: BidiResolver,
  codePoints: readonly number[],
  isBreak: (index: number) => boolean,
  direction: 'ltr' | 'rtl' | 'auto',
): AnalyzedParagraphs {
  const paragraphs: Paragraph[] = [];
  let start = 0;
  for (let i = 0; i <= codePoints.length; i++) {
    if (i < codePoints.length && !isBreak(i)) continue;
    if (i > start) {
      paragraphs.push({ start, end: i, analysis: engine.analyze(codePoints.slice(start, i), direction) });
    }
    start = i + 1;
  }

  const holding = (at: number): Paragraph | undefined => {
    let lo = 0;
    let hi = paragraphs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (paragraphs[mid].end <= at) lo = mid + 1;
      else hi = mid;
    }
    const p = paragraphs[lo];
    return p !== undefined && at >= p.start && at < p.end ? p : undefined;
  };

  return {
    reorder(from, to) {
      const p = holding(from);
      if (p === undefined || to > p.end) return { order: [], levels: [] };
      const r = engine.reorder(p.analysis, from - p.start, to - p.start);
      return { order: r.order.map((i) => i + p.start), levels: r.levels };
    },
    baseLevel(at) {
      const p = holding(at);
      return p === undefined ? 0 : engine.baseLevel(p.analysis);
    },
  };
}

/**
 * A line's visual order with the positions the engine removed (X9: bidi
 * controls, joiners, soft hyphens) put back beside the character each one
 * follows in the text, on the side that character's direction reads toward.
 * One opening the line sits before the first character that was kept.
 *
 * `order` holds positions `0..count-1` within the line; `rtl` answers for a
 * kept position.
 */
export function restoreRemoved(
  order: readonly number[],
  count: number,
  rtl: (pos: number) => boolean,
): number[] {
  if (order.length === count) return [...order];
  const kept = new Set(order);
  const leading: number[] = [];
  const following = new Map<number, number[]>();
  let anchor = -1;
  let firstKept = -1;
  for (let k = 0; k < count; k++) {
    if (kept.has(k)) {
      anchor = k;
      if (firstKept < 0) firstKept = k;
    } else if (anchor < 0) {
      leading.push(k);
    } else {
      const list = following.get(anchor);
      if (list) list.push(k);
      else following.set(anchor, [k]);
    }
  }
  if (firstKept < 0) return leading;
  const out: number[] = [];
  for (const p of order) {
    const after = following.get(p) ?? [];
    const before = p === firstKept ? leading : [];
    if (rtl(p)) out.push(...[...after].reverse(), p, ...[...before].reverse());
    else out.push(...before, p, ...after);
  }
  return out;
}

/** One line's visual order. */
export interface LineOrder {
  /** Positions within the line, in visual order, left to right. */
  readonly visual: readonly number[];
  /** Resolved embedding level per position; even reads left to right. */
  readonly levels: readonly number[];
}

/** Lines this long or shorter share one logical order per length. */
const SHARED_ORDER_LIMIT = 1024;
const logicalOrders: LineOrder[] = [];

/** `count` code points read left to right in the order they are stored: what
 *  every line laid out without a bidi engine gets, shared per length because
 *  a readout re-laid out every frame would build two arrays a line. */
function logicalOrder(count: number): LineOrder {
  const known = logicalOrders[count];
  if (known !== undefined) return known;
  const order: LineOrder = {
    visual: Object.freeze(Array.from({ length: count }, (_, pos) => pos)),
    levels: Object.freeze(new Array<number>(count).fill(0)),
  };
  if (count <= SHARED_ORDER_LIMIT) logicalOrders[count] = order;
  return order;
}

/**
 * The visual order of the line of `count` code points opening at `start` in
 * the text `paragraphs` analyzed. With no analysis that is logical order, all
 * at level 0. A position the engine removed still has a place: see
 * {@link restoreRemoved}.
 */
export function orderLine(
  paragraphs: AnalyzedParagraphs | null,
  start: number,
  count: number,
): LineOrder {
  if (paragraphs === null || count === 0) return logicalOrder(count);
  const levels = new Array<number>(count).fill(0);
  const r = paragraphs.reorder(start, start + count);
  for (let pos = 0; pos < count; pos++) {
    const level = r.levels[pos];
    if (typeof level === 'number' && level >= 0) levels[pos] = level;
  }
  // `opts.bidi` is a consumer's to supply, so its order is not trusted to be a
  // permutation: a repeat keeps its first place, and anything that is not a
  // position on the line is dropped.
  const kept = new Set<number>();
  for (const at of r.order) {
    const pos = at - start;
    if (Number.isInteger(pos) && pos >= 0 && pos < count) kept.add(pos);
  }
  return { visual: restoreRemoved([...kept], count, (pos) => levels[pos] % 2 === 1), levels };
}
