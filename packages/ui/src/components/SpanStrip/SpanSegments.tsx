import type { ReactElement } from 'react';
import type { PlacedSpan } from './spanLayout';
import s from './SpanStrip.module.css';

/** Where a segment sits and its color are the things about it no class can name, so they ride custom properties. */
function place(el: HTMLElement | null, { span, from, share, track, trackSpan, tracks }: PlacedSpan): void {
  if (!el) return;
  el.style.setProperty('--span-track', String(track));
  el.style.setProperty('--span-tracks', String(tracks));
  el.style.setProperty('--span-track-span', String(trackSpan));
  el.style.setProperty('--span-from', from.toFixed(5));
  el.style.setProperty('--span-share', share.toFixed(5));
  el.style.setProperty('--span-fill', Math.min(1, Math.max(0, span.fill ?? 1)).toFixed(4));
  if (span.color) el.style.setProperty('--span-color', span.color);
  else el.style.removeProperty('--span-color');
  if (span.ink) el.style.setProperty('--span-ink', span.ink);
  else el.style.removeProperty('--span-ink');
}

function Segment({ placed }: { placed: PlacedSpan }): ReactElement {
  const { span } = placed;
  return (
    <span
      ref={(el) => place(el, placed)} className={s.segment} data-state={span.state ?? 'pending'} data-open={placed.open ? '' : undefined}
      title={span.title ?? span.label}
    >
      <span className={s.label}>{span.content ?? span.label}</span>
    </span>
  );
}

/** The spans, each labeled and tinted in its color, unfilled. */
export function SpanSegments({ placed }: { placed: readonly PlacedSpan[] }): ReactElement {
  return <>{placed.map((p) => <Segment key={p.span.id} placed={p} />)}</>;
}

/** The same spans filled in their own colors, shown only left of the playhead. A copy, so nothing in a span's
 *  content can be reached through it: a click, focus, and assistive tech all find the one underneath. */
export function SpanPlayed({ placed }: { placed: readonly PlacedSpan[] }): ReactElement {
  return (
    <div className={s.played} aria-hidden="true" inert>
      {placed.map((p) => <Segment key={p.span.id} placed={p} />)}
    </div>
  );
}
