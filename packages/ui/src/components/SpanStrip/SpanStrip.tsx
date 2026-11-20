import { useLayoutEffect, useRef, type ReactElement } from 'react';
import { atFraction, spansTemplate, spokenAt, stripWindow, type SpanStripSpan } from './spanLayout';
import { SpanPlayed, SpanSegments } from './SpanSegments';
import { SpanPlayhead, SpanSeams } from './SpanMarks';
import { useSpanSeek } from './useSpanSeek';
import s from './SpanStrip.module.css';

/** Props for `<SpanStrip>`. */
export interface SpanStripProps {
  /** Laid end to end, each as wide as its share of the whole. */
  spans: readonly SpanStripSpan[];
  /** The playhead, in ms from the first span's start. Left of it, each span is filled in its color. */
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
 * Spans of time end to end on one track, with a playhead: the stretch behind the playhead is filled in each span's
 * own color, and a dotted seam marks where one span hands over to the next. A meter, or with `onSeek` a slider.
 */
export function SpanStrip({ spans, at, onSeek, 'aria-label': label, valueText, className }: SpanStripProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const template = spansTemplate(spans);
  const fraction = atFraction(spans, at);
  useLayoutEffect(() => { ref.current?.style.setProperty('--spans', template); }, [template]);
  useLayoutEffect(() => { ref.current?.style.setProperty('--at', fraction.toFixed(5)); }, [fraction]);
  const seek = useSpanSeek(spans, at, onSeek);
  const length = stripWindow(spans).to;
  return (
    <div
      ref={ref}
      className={className ? `${s.strip} ${className}` : s.strip}
      role={onSeek ? 'slider' : 'meter'}
      tabIndex={onSeek ? 0 : undefined}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(length)}
      aria-valuenow={Math.round(Math.min(length, Math.max(0, at)))}
      aria-valuetext={valueText ?? spokenAt(spans, at)}
      data-seekable={onSeek ? 'true' : undefined}
      {...seek}
    >
      <SpanSegments spans={spans} />
      <SpanPlayed spans={spans} />
      <SpanSeams spans={spans} />
      <SpanPlayhead />
    </div>
  );
}
