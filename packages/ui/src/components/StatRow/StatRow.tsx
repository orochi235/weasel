import { useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';
import s from './StatRow.module.css';

/** How a figure is set beside plain ones: an estimate (italic, muted), lighter, or a clock (light, held to a fixed
 *  width so its changing digits never move what follows). */
export type StatTone = 'estimate' | 'light' | 'clock';

/** One figure in a `StatRow`: a big value over a small word. */
export interface Stat {
  /** Default: the label. */
  key?: string;
  /** The small word under the figure. */
  label: string;
  value: ReactNode;
  tone?: StatTone;
  /** A note shown in a tooltip over the word, which is then dotted-underlined and focusable. */
  tip?: ReactNode;
  /** A CSS color drawn as a bar over the figure, to tie it to the same color elsewhere (a chart's series). */
  accent?: string;
}

/** Props for `<StatRow>`. */
export interface StatRowProps {
  stats: readonly Stat[];
  'aria-label': string;
  /** How figures share the row's width: packed from the start, or spread end to end. Default `'start'`. */
  justify?: 'start' | 'between';
  className?: string;
}

const TONE: Readonly<Record<StatTone, string>> = { estimate: s.estimate!, light: s.light!, clock: s.clock! };

function StatItem({ stat }: { stat: Stat }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (stat.accent) ref.current?.style.setProperty('--stat-accent', stat.accent);
    else ref.current?.style.removeProperty('--stat-accent');
  }, [stat.accent]);
  return (
    <div ref={ref} className={stat.tone ? `${s.stat} ${TONE[stat.tone]}` : s.stat} data-tone={stat.tone}>
      <dt className={s.label}>
        {stat.tip ? (
          <TooltipTrigger>
            <Focusable><span className={s.tipped} tabIndex={0}>{stat.label}</span></Focusable>
            <Tooltip placement="top">{stat.tip}</Tooltip>
          </TooltipTrigger>
        ) : stat.label}
      </dt>
      <dd className={s.value} title={stat.tone === 'estimate' ? 'an estimate' : undefined}>{stat.value}</dd>
    </div>
  );
}

/**
 * A row of headline figures, each a big right-aligned value over its word, wrapping when the row runs out of room.
 * The word comes first in the markup, so a screen reader reads it before the value. An estimate is set apart by its
 * type, not a sign before it.
 */
export function StatRow({ stats, 'aria-label': label, justify = 'start', className }: StatRowProps): ReactElement {
  return (
    <dl className={className ? `${s.row} ${className}` : s.row} aria-label={label} data-justify={justify}
      data-accented={stats.some((st) => st.accent) ? '' : undefined}>
      {stats.map((stat) => <StatItem key={stat.key ?? stat.label} stat={stat} />)}
    </dl>
  );
}
