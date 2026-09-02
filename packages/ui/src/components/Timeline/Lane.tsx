import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { EventTrack, SampledTrack } from '@weasel-js/core';
import s from './Timeline.module.css';
import { createTimeScale, type TimeWindow } from './timeScale';
import { snapTime } from './keys';
import type { LaneRow } from './lanes';

/** Snap radius, in track pixels. */
const SNAP_PX = 6;

/** One arrow-key step, in ms; shift multiplies by ten. */
const KEY_STEP_MS = 10;

export interface LaneProps {
  row: LaneRow;
  window: TimeWindow;
  mode: 'dope' | 'graph';
  /** Index of the selected key on THIS row, or null. */
  selection: number | null;
  onSelect: (keyIndex: number) => void;
  /** Live during a drag. */
  onKeyInput: (keyIndex: number, toMs: number) => void;
  /** Once, at the end of a gesture. */
  onKeyCommit: (keyIndex: number, toMs: number) => void;
  onInsert: (atMs: number) => void;
  onToggleExpand: () => void;
  expanded: boolean;
  /** Times a dragged key snaps to. */
  snapTimes: readonly number[];
}

function entryTimes(row: LaneRow): number[] {
  if (row.kind === 'sampled') return (row.track as SampledTrack<unknown>).keys.map((k) => k.t);
  if (row.kind === 'event') return (row.track as EventTrack).events.map((e) => e.t);
  return [];
}

export function Lane(props: LaneProps): ReactElement {
  const { row, window: win, selection, onSelect, onKeyInput, onKeyCommit, onInsert, onToggleExpand, expanded, snapTimes } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { endDragRef.current?.(); }, []);

  const span = win.to - win.from;
  const pct = (ms: number): string => `${span === 0 ? 0 : ((ms + row.offset - win.from) / span) * 100}%`;

  const msAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return win.from;
    return createTimeScale(win, rect.width).toMs(clientX - rect.left) - row.offset;
  };

  const snapPxToMs = (): number => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    return width === 0 ? 0 : (SNAP_PX / width) * span;
  };

  const onKeyPointerDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(i);

    const at = (ev: { clientX: number; altKey: boolean }): number => {
      const raw = Math.max(0, msAt(ev.clientX));
      return ev.altKey ? raw : snapTime(raw, snapTimes, snapPxToMs());
    };

    const move = (ev: PointerEvent): void => { onKeyInput(i, at(ev)); };
    const up = (ev: PointerEvent): void => { onKeyCommit(i, at(ev)); end(); };
    const end = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', end);
      endDragRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', end);
    endDragRef.current = end;
  };

  const onKeyDown = (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = KEY_STEP_MS * (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowRight') { e.preventDefault(); onKeyCommit(i, t + step); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onKeyCommit(i, Math.max(0, t - step)); }
  };

  const times = entryTimes(row);

  return (
    <div className={s.lane} data-depth={row.depth}>
      <div className={s.laneLabel}>
        {row.kind === 'timeline' ? (
          <span
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            data-testid="timeline-disclosure"
            className={s.disclosure}
            onClick={onToggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : null}
        {row.label}
      </div>
      <div
        className={s.laneTrack}
        ref={trackRef}
        data-testid="timeline-lane-track"
        onDoubleClick={(e) => { if (row.kind === 'sampled') onInsert(Math.max(0, msAt(e.clientX))); }}
      >
        {row.kind === 'timeline' ? (
          <div
            className={s.nestedBar}
            data-testid="timeline-nested"
            style={{ left: pct(0), width: `${span === 0 ? 0 : (row.track.timeline.duration ?? 0) / span * 100}%` }}
          />
        ) : null}
        {times.map((t, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`${row.label} key at ${Math.round(t)} ms`}
            aria-current={selection === i ? 'true' : undefined}
            data-testid={row.kind === 'event' ? 'timeline-event' : 'timeline-key'}
            className={row.kind === 'event' ? s.eventMark : s.key}
            style={{ left: pct(t) }}
            onPointerDown={onKeyPointerDown(i)}
            onKeyDown={onKeyDown(i, t)}
          />
        ))}
      </div>
    </div>
  );
}
