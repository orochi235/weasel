import { useLayoutEffect, useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { linearScale } from '@weasel-js/scale';
import { useElementSize } from '@weasel-js/routing/react';
import type { Span } from '@weasel-js/ui-input';
import { Ruler, type RulerTick } from '../Ruler';
import { SpanStrip, type SpanStripProps } from './SpanStrip';
import { atFraction } from './spanLayout';
import s from './SpanStrip.module.css';

/** A row's grid line, which its lead and strip both take: placed rows leave no cell for the playhead to push them out of. */
const rowAt = (el: HTMLElement | null, i: number): void => { el?.style.setProperty('--row', String(i + 1)); };

/** Minimum gap between the ruler's ticks, in px. */
const TICK_SPACING_PX = 64;

/** One row of a `SpanStrips` stack: a strip on the stack's clock, and what sits before it. */
export interface SpanStripsRow extends Omit<SpanStripProps, 'className' | 'window' | 'at' | 'onSeek'> {
  id: string;
  /** Before the strip, in a column as wide as the widest. */
  lead?: ReactNode;
  /** On the row. */
  className?: string;
}

/** The ruler under a stack: ticks at a round step of the clock, each labeled by `format`. */
export interface SpanStripsRuler {
  /** Tick steps to choose from, in ms, smallest first: the stack takes the first that leaves ticks far enough apart. */
  steps: readonly number[];
  /** Ticks fall on `origin` plus whole steps. Default: 0, so every step counts from the epoch. */
  origin?: number;
  /** A tick's label, given its time. */
  format: (ms: number) => ReactNode;
}

/** The ruler's ticks across `win` at the first of `steps` that keeps them `TICK_SPACING_PX` apart at `widthPx`. */
export function rulerTicks(win: Span, widthPx: number, { steps, origin = 0, format }: SpanStripsRuler): RulerTick[] {
  const length = win.to - win.from;
  if (length <= 0 || widthPx <= 0 || steps.length === 0) return [];
  const step = steps.find((st) => (st / length) * widthPx >= TICK_SPACING_PX) ?? steps.at(-1)!;
  const first = origin + Math.ceil((win.from - origin) / step) * step;
  const out: RulerTick[] = [];
  for (let t = first; t <= win.to; t += step) out.push({ at: t, label: format(t) });
  return out;
}

/** Props for `<SpanStrips>`. */
export interface SpanStripsProps {
  rows: readonly SpanStripsRow[];
  /** The clock every row's strip is drawn on, in ms. */
  window: Span;
  /** The one playhead, a line down the whole stack. Not given, there is none, and every strip plays to its end. */
  at?: number;
  /** Given, a ruler under the stack. */
  ruler?: SpanStripsRuler;
  'aria-label'?: string;
  className?: string;
}

/**
 * `SpanStrip`s stacked flush on one clock, neighbors sharing a single border line, with one playhead down the whole
 * stack, a column of leads before the strips, and optionally a ruler under them.
 */
export function SpanStrips({ rows, window: win, at, ruler, 'aria-label': label, className }: SpanStripsProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const fraction = at === undefined ? 1 : atFraction(win, at);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--rows', String(Math.max(1, rows.length)));
    ref.current?.style.setProperty('--at', fraction.toFixed(5));
  }, [rows.length, fraction]);
  const rulerRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(rulerRef);
  const scale = useMemo(() => linearScale({ domain: [win.from, win.to], range: [0, 1] }), [win.from, win.to]);
  const ticks = ruler ? rulerTicks(win, width, ruler) : [];
  return (
    <div ref={ref} className={className ? `${s.stack} ${className}` : s.stack}>
      <div className={s.rows} role="list" aria-label={label}>
        {rows.map(({ id, lead, className: rowClass, ...strip }, i) => (
          <div key={id} ref={(el) => rowAt(el, i)} role="listitem" className={rowClass ? `${s.row} ${rowClass}` : s.row}>
            <span className={s.lead}>{lead}</span>
            <SpanStrip {...strip} window={win} at={at ?? win.to} />
          </div>
        ))}
        {at !== undefined && <span className={s.stackHead} aria-hidden="true" />}
      </div>
      {ruler && <Ruler ref={rulerRef} className={s.ruler} look="line" scale={scale} ticks={ticks} aria-hidden="true" />}
    </div>
  );
}
