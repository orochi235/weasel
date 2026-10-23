import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { useLatest } from '@weasel-js/core';
import on from '../Along/onRun.module.css';
import s from './Slider.module.css';
import { GAP, staggerRows } from './staggerRows';

/** Each readout at its `g` along a curve, below the track and tipped to it, stepping down a row where two would overlap. */
export function ReadoutsAlong({ readouts, place, length }: {
  readouts: readonly { g: number; content: ReactNode }[];
  place: (g: number) => CSSProperties;
  length: number;
}): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);

  // Row depends on rendered text widths, so it is measured and written after layout, every render, and again whenever a
  // readout's size changes without one.
  const restack = useLatest(() => {
    const items = [...(ref.current?.children ?? [])] as HTMLElement[];
    const spans = items.map((el, i) => {
      const mid = readouts[i]!.g * length;
      const half = el.offsetWidth / 2;
      return { start: mid - half, end: mid + half };
    });
    staggerRows(spans, GAP).forEach((row, i) => items[i]!.style.setProperty('--row', String(row)));
  });
  useLayoutEffect(() => restack.current());
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => restack.current());
    for (const el of ref.current?.children ?? []) observer.observe(el);
    return () => observer.disconnect();
  }, [readouts.length, restack]);

  return (
    <div ref={ref} className={s.readoutsAlong}>
      {readouts.map((r, i) => (
        <span key={i} data-readout="below" className={`${s.readoutAlong} ${on.onRun}`} style={place(r.g)}>
          {r.content}
        </span>
      ))}
    </div>
  );
}
