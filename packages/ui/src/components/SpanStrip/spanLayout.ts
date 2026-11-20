import { spanFraction, spanShare, spanValue, type Span } from '@weasel-js/ui-input';

/** Where a span stands: not begun, under way, finished, or stopped short. */
export type SpanState = 'pending' | 'active' | 'done' | 'failed';

/** One stretch of a `SpanStrip`, as wide as its share of the whole. */
export interface SpanStripSpan {
  id: string;
  /** Shown in the segment, cut short with an ellipsis where it does not fit. */
  label: string;
  /** Its length; a negative one counts as none. */
  ms: number;
  /** Any CSS color, `var(--…)` included, that fills the played part of it. Default: the accent. */
  color?: string;
  /** Default: `'pending'`. */
  state?: SpanState;
  /** The segment's tooltip. Default: `label`. */
  title?: string;
}

const lengthOf = (span: SpanStripSpan): number => Math.max(0, span.ms);

/** The whole strip, from 0 to every span's length laid end to end. */
export function stripWindow(spans: readonly SpanStripSpan[]): Span {
  return { from: 0, to: spans.reduce((n, s) => n + lengthOf(s), 0) };
}

/** The strip's `grid-template-columns`: a column per span, each its share of the whole. */
export function spansTemplate(spans: readonly SpanStripSpan[]): string {
  const win = stripWindow(spans);
  if (win.to <= 0) return spans.map(() => '1fr').join(' ') || '1fr';
  return spans.map((s) => `${spanShare(win, lengthOf(s)).toFixed(5)}fr`).join(' ');
}

const clamp01 = (f: number): number => Math.min(1, Math.max(0, f));

/** Where `at` sits along the strip, 0 to 1. */
export function atFraction(spans: readonly SpanStripSpan[], at: number): number {
  return clamp01(spanFraction(stripWindow(spans), at));
}

/** The time at fraction `f` of the strip, held inside it. */
export function msAtFraction(spans: readonly SpanStripSpan[], f: number): number {
  return spanValue(stripWindow(spans), clamp01(f));
}

/** The span holding `at`: the last one starting at or before it. */
export function spanAt(spans: readonly SpanStripSpan[], at: number): SpanStripSpan | undefined {
  let start = 0;
  let found: SpanStripSpan | undefined;
  for (const s of spans) {
    if (start > at) break;
    found = s;
    start += lengthOf(s);
  }
  return found;
}

/** How a screen reader says where `at` is, when the caller gives no words of its own: `fix, 40% through`. */
export function spokenAt(spans: readonly SpanStripSpan[], at: number): string {
  const span = spanAt(spans, at);
  const pct = `${Math.round(atFraction(spans, at) * 100)}% through`;
  return span ? `${span.label}, ${pct}` : pct;
}
