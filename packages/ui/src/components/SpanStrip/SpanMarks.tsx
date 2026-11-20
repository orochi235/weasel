import type { ReactElement } from 'react';
import type { PlacedSpan } from './spanLayout';
import s from './SpanStrip.module.css';

const seamAt = (el: HTMLElement | null, at: number): void => { el?.style.setProperty('--seam-at', at.toFixed(5)); };

/** A dotted line at the end of each span that stops short of the strip's end. */
export function SpanSeams({ placed }: { placed: readonly PlacedSpan[] }): ReactElement {
  return (
    <>
      {placed.filter((p) => p.share > 0 && p.from + p.share < 0.999).map((p) => (
        <span key={p.span.id} ref={(el) => seamAt(el, p.from + p.share)} className={s.seam} aria-hidden="true" />
      ))}
    </>
  );
}

/** The line at the strip's `--at`. */
export function SpanPlayhead(): ReactElement {
  return <span className={s.playhead} aria-hidden="true" />;
}
