import type { ReactElement } from 'react';
import type { SpanStripSpan } from './spanLayout';
import s from './SpanStrip.module.css';

/** A segment's color is the one thing about it no class can name, so it rides a custom property. */
function paint(el: HTMLElement | null, color: string | undefined): void {
  if (!el) return;
  if (color) el.style.setProperty('--span-color', color);
  else el.style.removeProperty('--span-color');
}

function Segment({ span }: { span: SpanStripSpan }): ReactElement {
  return (
    <span ref={(el) => paint(el, span.color)} className={s.segment} data-state={span.state ?? 'pending'} title={span.title ?? span.label}>
      {span.label}
    </span>
  );
}

/** The spans end to end, each labeled, unfilled. */
export function SpanSegments({ spans }: { spans: readonly SpanStripSpan[] }): ReactElement {
  return <>{spans.map((span) => <Segment key={span.id} span={span} />)}</>;
}

/** The same spans filled in their own colors, shown only left of the playhead. */
export function SpanPlayed({ spans }: { spans: readonly SpanStripSpan[] }): ReactElement {
  return (
    <div className={s.played} aria-hidden="true">
      {spans.map((span) => <Segment key={span.id} span={span} />)}
    </div>
  );
}
