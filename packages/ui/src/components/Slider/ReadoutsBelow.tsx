import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from 'react';
import s from './Slider.module.css';
import { GAP, staggerRows } from './staggerRows';

export interface Readout {
  /** Where along the track its thumb sits, 0–1. */
  fraction: number;
  content: ReactNode;
}

/** Steps each readout down to the first row where it overlaps nothing to its left, and sizes the row to hold them. */
function stagger(row: HTMLElement): void {
  const items = [...row.children] as HTMLElement[];
  for (const item of items) item.style.top = '0px';
  row.style.height = '';
  // In the row's own px, so a rotated ancestor leaves them side by side. Each is centered on its left by a translate.
  const boxes = items.map((item) => ({ start: item.offsetLeft - item.offsetWidth / 2, width: item.offsetWidth, height: item.offsetHeight }));
  // With no layout to measure (jsdom, a hidden panel) there is nothing to avoid.
  if (boxes.every((b) => b.width === 0)) return;
  const rowHeight = Math.max(...boxes.map((b) => b.height));
  const rows = staggerRows(boxes.map((b) => ({ start: b.start, end: b.start + b.width })), GAP);
  rows.forEach((at, i) => { items[i]!.style.top = `${at * rowHeight}px`; });
  row.style.height = `${(Math.max(...rows) + 1) * rowHeight}px`;
}

/**
 * Each thumb's readout under it. A readout that would overlap one to its left steps down to the first row where
 * it fits, so thumbs close together keep every readout legible.
 */
export function ReadoutsBelow({ readouts, place }: { readouts: readonly Readout[]; place: (fraction: number) => CSSProperties }) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Positions depend on rendered text widths, so they are measured and written after layout, every render.
  useLayoutEffect(() => {
    if (ref.current) stagger(ref.current);
  });

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => stagger(row));
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={s.readoutsBelow}>
      {readouts.map((r, i) => (
        <span key={i} data-readout="below" className={s.readoutBelow} style={place(r.fraction)}>
          {r.content}
        </span>
      ))}
    </div>
  );
}
