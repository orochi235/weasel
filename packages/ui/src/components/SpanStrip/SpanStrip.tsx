import { useLayoutEffect, useRef, type ReactElement } from 'react';
import type { Span } from '@weasel-js/ui-input';
import { atFraction, placeSpans, spokenAt, stripWindow, type SpanStripSpan } from './spanLayout';
import { SpanPlayed, SpanSegments } from './SpanSegments';
import { SpanPlayhead, SpanSeams } from './SpanMarks';
import { useSpanSeek } from './useSpanSeek';
import s from './SpanStrip.module.css';

/** Props for `<SpanStrip>`. */
export interface SpanStripProps {
  /** Each placed at its `start`, or end to end where they give none. */
  spans: readonly SpanStripSpan[];
  /** The span of time the strip shows, in ms. Default: from 0 to where the last span ends. */
  window?: Span;
  /** The playhead, in the strip's time. Left of it, each span is filled in its color. */
  at: number;
  /** Given, the strip is a slider: a press or drag seeks with `held` true, and letting go seeks with it false.
   *  Not given, it only shows where `at` is. */
  onSeek?: (ms: number, held: boolean) => void;
  'aria-label': string;
  /** What a screen reader says of `at`. Default: the span it is in, and how far along the strip. */
  valueText?: string;
  className?: string;
}

/**
 * Spans of time on one track, with a playhead: the stretch behind the playhead is filled in each span's own color,
 * and a dotted seam marks where each span ends. A meter, or with `onSeek` a slider.
 */
export function SpanStrip({ spans, window, at, onSeek, 'aria-label': label, valueText, className }: SpanStripProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const win = stripWindow(spans, window);
  const placed = placeSpans(spans, win);
  const fraction = atFraction(win, at);
  useLayoutEffect(() => { ref.current?.style.setProperty('--at', fraction.toFixed(5)); }, [fraction]);
  const seek = useSpanSeek(win, at, onSeek);
  return (
    <div
      ref={ref}
      className={className ? `${s.strip} ${className}` : s.strip}
      role={onSeek ? 'slider' : 'meter'}
      tabIndex={onSeek ? 0 : undefined}
      aria-label={label}
      aria-valuemin={Math.round(win.from)}
      aria-valuemax={Math.round(win.to)}
      aria-valuenow={Math.round(Math.min(win.to, Math.max(win.from, at)))}
      aria-valuetext={valueText ?? spokenAt(placed, win, at)}
      data-seekable={onSeek ? 'true' : undefined}
      {...seek}
    >
      <SpanSegments placed={placed} />
      <SpanPlayed placed={placed} />
      <SpanSeams placed={placed} />
      <SpanPlayhead />
    </div>
  );
}
