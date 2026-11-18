import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement, RefObject } from 'react';
import type { Keyframe } from '@weasel-js/animator';
import type { FocusHoldAttrs } from '../Disabled/controlHold';
import s from './Timeline.module.css';
import { spanPercent, type TimeWindow } from './timeScale';
import type { LaneRow } from './lanes';

/** What every mark on a lane carries of the timeline's hold. */
export type MarkHold = { tabIndex: 0 | -1 } & FocusHoldAttrs;

/** One focusable segment per pair of neighboring keys, named by the key it runs into. */
export function SegmentMarks({ keys, label, win, pct, mark, selectedSegment, onSelectSegment }: {
  keys: readonly Keyframe<unknown>[];
  label: string;
  win: TimeWindow;
  pct: (ms: number) => string;
  mark: MarkHold;
  selectedSegment: number | null;
  onSelectSegment?: (keyIndex: number) => void;
}): ReactElement {
  return (
    <>
      {keys.slice(1).map((k, idx) => {
        const i = idx + 1;
        return (
          <div
            key={`seg-${i}`}
            role="button"
            {...mark}
            aria-label={`${label} segment into ${Math.round(k.t)} ms`}
            aria-current={selectedSegment === i ? 'true' : undefined}
            data-testid="timeline-segment"
            data-segment-index={i}
            className={s.segment}
            style={{ left: pct(keys[i - 1].t), width: spanPercent(win, k.t - keys[i - 1].t) }}
            onClick={() => onSelectSegment?.(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment?.(i); } }}
          />
        );
      })}
    </>
  );
}

/** One focusable mark per key or event on a row, at its time. */
export function KeyMarks({ row, times, pct, mark, selection, draggedIndex, keyEls, onKeyPointerDown, onKeyDown }: {
  row: LaneRow;
  times: readonly number[];
  pct: (ms: number) => string;
  mark: MarkHold;
  selection: number | null;
  draggedIndex: number | undefined;
  keyEls: RefObject<(HTMLDivElement | null)[]>;
  onKeyPointerDown: (i: number) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}): ReactElement {
  const event = row.kind === 'event';
  return (
    <>
      {times.map((t, i) => (
        <div
          key={i}
          ref={(el) => { keyEls.current[i] = el; }}
          role="button"
          {...mark}
          aria-label={`${row.label} key at ${Math.round(t)} ms`}
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
