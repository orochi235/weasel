import { type ReactNode, useLayoutEffect, useRef } from 'react';
import s from './Slider.module.css';

/** Space kept between two readouts sharing a row, in px. */
const GAP = 4;

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
  const boxes = items.map((item) => item.getBoundingClientRect());
  // With no layout to measure (jsdom, a hidden panel) there is nothing to avoid.
  if (boxes.every((b) => b.width === 0)) return;
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a]!.left - boxes[b]!.left);
  const rightEdges: number[] = [];
  const rowHeight = Math.max(...boxes.map((b) => b.height));
  for (const i of order) {
    const box = boxes[i]!;
    let at = rightEdges.findIndex((right) => box.left >= right + GAP);
    if (at < 0) at = rightEdges.push(0) - 1;
    rightEdges[at] = box.right;
    items[i]!.style.top = `${at * rowHeight}px`;
  }
  row.style.height = `${rightEdges.length * rowHeight}px`;
}

/**
 * Each thumb's readout under it. A readout that would overlap one to its left steps down to the first row where
 * it fits, so thumbs close together keep every readout legible.
 */
export function ReadoutsBelow({ readouts }: { readouts: readonly Readout[] }) {
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
        <span key={i} data-readout="below" className={s.readoutBelow} style={{ left: `${r.fraction * 100}%` }}>
          {r.content}
        </span>
      ))}
    </div>
  );
}
