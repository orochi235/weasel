import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import type { MarkHold } from '../Disabled/controlHold';
import s from './Timeline.module.css';
import { useFieldLocale } from '../../useFieldLocale';
import { markTimeText, spanPercent, type TimeWindow } from './timeScale';
import type { LaneRow } from './lanes';

export type { MarkHold };

/** One focusable segment per pair of neighboring keys, named by the key it runs into. */
export function SegmentMarks({ times, label, offset, win, pct, mark, selectedSegment, onSelectSegment }: {
  /** The row's key times, the same list its key marks are drawn from. */
  times: readonly number[];
  label: string;
  /** Where the row's own time starts on the ruler, which its names read. */
  offset: number;
  win: TimeWindow;
  pct: (ms: number) => string;
  mark: MarkHold;
  selectedSegment: number | null;
  onSelectSegment?: (keyIndex: number) => void;
}): ReactElement {
  const locale = useFieldLocale();
  return (
    <>
      {times.slice(1).map((t, idx) => {
        const i = idx + 1;
        return (
          <div
            key={`seg-${i}`}
            role="button"
            {...mark}
            aria-label={`${label} segment into ${markTimeText(t + offset, locale)}`}
            aria-current={selectedSegment === i ? 'true' : undefined}
            data-testid="timeline-segment"
            data-segment-index={i}
            className={s.segment}
            style={{ left: pct(times[i - 1]), width: spanPercent(win, t - times[i - 1]) }}
            onClick={() => onSelectSegment?.(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment?.(i); } }}
          />
        );
      })}
    </>
  );
}

/** One focusable mark per key or event on a row, at its time. */
export function KeyMarks({ row, times, pct, mark, selection, draggedIndex, onKeyPointerDown, onKeyDown }: {
  row: LaneRow;
  times: readonly number[];
  pct: (ms: number) => string;
  mark: MarkHold;
  selection: number | null;
  draggedIndex: number | undefined;
  onKeyPointerDown: (i: number) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}): ReactElement {
  const event = row.kind === 'event';
  const locale = useFieldLocale();
  return (
    <>
      {times.map((t, i) => (
        <div
          key={i}
          role="button"
          {...mark}
          aria-label={`${row.label} ${event ? 'event' : 'key'} at ${markTimeText(t + row.offset, locale)}`}
          aria-current={selection === i ? 'true' : undefined}
          data-testid={event ? 'timeline-event' : 'timeline-key'}
          data-keyframe-index={i}
          data-dragging={draggedIndex === i ? 'true' : undefined}
          data-past={t + row.offset > row.end ? 'true' : undefined}
          className={event ? s.eventMark : s.key}
          style={{ left: pct(t) }}
          onPointerDown={onKeyPointerDown(i)}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={onKeyDown(i, t)}
        />
      ))}
    </>
  );
}

/** Where a dragged key would land, drawn over the committed key it moves from. */
export function KeyGhost({ event, left }: { event: boolean; left: string }) {
  return <div aria-hidden="true" data-testid="timeline-key-ghost" className={event ? s.eventGhost : s.keyGhost} style={{ left }} />;
}
