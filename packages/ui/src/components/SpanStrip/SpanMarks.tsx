import type { ReactElement } from 'react';
import type { SpanStripSpan } from './spanLayout';
import s from './SpanStrip.module.css';

/** A dotted line where each span meets the next, drawn as the end edge of a cell laid over the segments. */
export function SpanSeams({ spans }: { spans: readonly SpanStripSpan[] }): ReactElement {
  return (
    <div className={s.seams} aria-hidden="true">
      {spans.map((span) => <span key={span.id} className={s.seam} />)}
    </div>
  );
}

/** The line at `at`. */
export function SpanPlayhead(): ReactElement {
  return <span className={s.playhead} aria-hidden="true" />;
}
