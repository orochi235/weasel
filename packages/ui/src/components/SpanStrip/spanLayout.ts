import { spanFraction, spanShare, spanValue, type Span } from '@weasel-js/ui-input';

/** Where a span stands: not begun, under way, finished, or stopped short. */
export type SpanState = 'pending' | 'active' | 'done' | 'failed';

/** One stretch of a `SpanStrip`. */
export interface SpanStripSpan {
  id: string;
  /** Shown in the segment, cut short with an ellipsis where it does not fit. */
  label: string;
  /** Its length; a negative one counts as none. */
  ms: number;
  /** Where it begins, in the strip's time. Default: where the span before it ends, or the window's start. */
  start?: number;
  /** Any CSS color, `var(--…)` included, that fills the played part of it and tints the rest. Default: the accent. */
  color?: string;
  /** How much of it the played layer fills, 0 to 1, from its start: progress inside the span, apart from where the
   *  playhead is. Default: 1. */
  fill?: number;
  /** Default: `'pending'`, drawn dimmed. */
  state?: SpanState;
  /** The segment's tooltip. Default: `label`. */
  title?: string;
}

/** A span where the strip draws it: its start and length as fractions of the window. */
export interface PlacedSpan {
  readonly span: SpanStripSpan;
  readonly start: number;
  readonly end: number;
  readonly from: number;
  readonly share: number;
}

const lengthOf = (span: SpanStripSpan): number => Math.max(0, span.ms);

/** Each span's start and end in the strip's time, every one without a `start` following the one before it. */
function timed(spans: readonly SpanStripSpan[], origin: number): { span: SpanStripSpan; start: number; end: number }[] {
  let cursor = origin;
  return spans.map((span) => {
    const start = span.start ?? cursor;
    cursor = start + lengthOf(span);
    return { span, start, end: cursor };
  });
}

/** The window a strip shows: `window` as given, or else from 0 to where the last span ends. */
export function stripWindow(spans: readonly SpanStripSpan[], window?: Span): Span {
  if (window) return window;
  return { from: 0, to: Math.max(0, ...timed(spans, 0).map((t) => t.end)) };
}

/** Every span placed along `win`, a fraction of it from its start and a fraction long. */
export function placeSpans(spans: readonly SpanStripSpan[], win: Span): PlacedSpan[] {
  return timed(spans, win.from).map(({ span, start, end }) => ({
    span, start, end, from: spanFraction(win, start), share: spanShare(win, end - start),
  }));
}

const clamp01 = (f: number): number => Math.min(1, Math.max(0, f));

/** Where `at` sits along `win`, held between 0 and 1. */
export const atFraction = (win: Span, at: number): number => clamp01(spanFraction(win, at));

/** The time at fraction `f` of `win`, held inside it. */
export const msAtFraction = (win: Span, f: number): number => spanValue(win, clamp01(f));

/** The span holding `at`, or else the last one to start before it. */
export function spanAt(placed: readonly PlacedSpan[], at: number): SpanStripSpan | undefined {
  const holding = placed.find((p) => p.start <= at && at < p.end);
  if (holding) return holding.span;
  return placed.filter((p) => p.start <= at).sort((x, y) => y.start - x.start)[0]?.span;
}

/** How a screen reader says where `at` is, when the caller gives no words of its own: `fix, 40% through`. */
export function spokenAt(placed: readonly PlacedSpan[], win: Span, at: number): string {
  const span = spanAt(placed, at);
  const pct = `${Math.round(atFraction(win, at) * 100)}% through`;
  return span ? `${span.label}, ${pct}` : pct;
}
