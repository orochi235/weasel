import type { ReactNode } from 'react';
import { spanFraction, spanShare, spanValue, type Span } from '@weasel-js/ui-input';

/** Where a span stands: not begun, under way, finished, or stopped short. */
export type SpanState = 'pending' | 'active' | 'done' | 'failed';

/** One stretch of a `SpanStrip`. */
export interface SpanStripSpan {
  id: string;
  /** Shown in the segment, cut short with an ellipsis where it does not fit. */
  label: string;
  /** What the segment shows in place of `label`, so part of it can be marked up; `label` stays its words for the
   *  tooltip and for screen readers. Default: `label`. */
  content?: ReactNode;
  /** Its length; a negative one counts as none. */
  ms: number;
  /** Where it begins, in the strip's time. Default: where the spans before it on its tracks end, the latest of them, or the window's start. */
  start?: number;
  /** Any CSS color, `var(--…)` included, that fills the played part of it and tints the rest. Default: the accent. */
  color?: string;
  /** Its label's color, filled or not. Default: the foreground over the track, and whichever of black or white reads
   *  on `color` where filled. */
  ink?: string;
  /** How much of it the played layer fills, 0 to 1, from its start: progress inside the span, apart from where the
   *  playhead is. Default: 1. */
  fill?: number;
  /** Default: `'pending'`, drawn dimmed. */
  state?: SpanState;
  /** The segment's tooltip. Default: `label`. */
  title?: string;
  /** Which stripe of the strip it runs along, from 0 at the top: a strip with spans on several tracks splits its height
   *  into that many stripes, and each track's spans follow one another apart from the rest. Default: 0. */
  track?: number;
  /** How many tracks it covers, from its own down, as a table cell's `rowSpan` does. Default: 1. */
  trackSpan?: number;
}

/** A span where the strip draws it: its start and length as fractions of the window. */
export interface PlacedSpan {
  readonly span: SpanStripSpan;
  readonly start: number;
  readonly end: number;
  readonly from: number;
  readonly share: number;
  /** Its first stripe, how many it covers, and how many the strip has. */
  readonly track: number;
  readonly trackSpan: number;
  readonly tracks: number;
  /** Nothing starts at or after its end on any stripe it covers, so its label may run on over the empty track. */
  readonly open: boolean;
}

const lengthOf = (span: SpanStripSpan): number => Math.max(0, span.ms);

const trackOf = (span: SpanStripSpan): number => Math.max(0, Math.floor(span.track ?? 0));
const trackSpanOf = (span: SpanStripSpan): number => Math.max(1, Math.floor(span.trackSpan ?? 1));
const coveredBy = (span: SpanStripSpan): number[] => Array.from({ length: trackSpanOf(span) }, (_, i) => trackOf(span) + i);

/** Each span's start and end in the strip's time, every one without a `start` following the latest end on the tracks
 *  it covers. */
function timed(spans: readonly SpanStripSpan[], origin: number): { span: SpanStripSpan; start: number; end: number }[] {
  const cursors = new Map<number, number>();
  return spans.map((span) => {
    const covered = coveredBy(span);
    const start = span.start ?? Math.max(origin, ...covered.map((t) => cursors.get(t) ?? origin));
    const end = start + lengthOf(span);
    for (const t of covered) cursors.set(t, Math.max(cursors.get(t) ?? origin, end));
    return { span, start, end };
  });
}

/** The window a strip shows: `window` as given, or else from 0 to where the last span ends. */
export function stripWindow(spans: readonly SpanStripSpan[], window?: Span): Span {
  if (window) return window;
  return { from: 0, to: Math.max(0, ...timed(spans, 0).map((t) => t.end)) };
}

/** Every span placed along `win`, a fraction of it from its start and a fraction long. */
export function placeSpans(spans: readonly SpanStripSpan[], win: Span): PlacedSpan[] {
  const tracks = Math.max(1, ...spans.map((span) => trackOf(span) + trackSpanOf(span)));
  const all = timed(spans, win.from);
  const sharesStripe = (a: SpanStripSpan, b: SpanStripSpan) =>
    trackOf(a) < trackOf(b) + trackSpanOf(b) && trackOf(b) < trackOf(a) + trackSpanOf(a);
  return all.map(({ span, start, end }) => ({
    span, start, end, from: spanFraction(win, start), share: spanShare(win, end - start),
    track: trackOf(span), trackSpan: trackSpanOf(span), tracks,
    open: !all.some((o) => o.span !== span && o.start >= end && sharesStripe(span, o.span)),
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
