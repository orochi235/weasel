import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
import { type EventTrack, type Keyframe, type SampledTrack, type TimelineTrack } from '@weasel-js/animator';
import { DisclosureMark } from '../Disclosure';
import s from './Timeline.module.css';
import { spanPercent, toPercent, type TimeWindow } from './timeScale';
import { arrowMove } from '@weasel-js/ui-input';
import { LaneGraph } from './LaneGraph';
import type { LaneRow } from './lanes';
import { useKeyDrag } from './useKeyDrag';

/** One arrow-key step, in ms; shift multiplies by ten. */
const KEY_STEP_MS = 10;

export interface LaneProps {
  row: LaneRow;
  window: TimeWindow;
  mode: 'dope' | 'graph';
  /** Index of the selected key on THIS row, or null. */
  selection: number | null;
  onSelect: (keyIndex: number) => void;
  /** Live during a dope-sheet drag. */
  onKeyInput: (keyIndex: number, toMs: number) => void;
  /** Once, at the end of a dope-sheet gesture. */
  onKeyCommit: (keyIndex: number, toMs: number) => void;
  /** Live during a graph-mode key drag: the row's whole key list. */
  onKeysInput?: (keys: readonly Keyframe<number>[]) => void;
  /** Once per graph-mode edit: the row's whole key list. */
  onKeysCommit?: (keys: readonly Keyframe<number>[]) => void;
  onInsert: (atMs: number) => void;
  onToggleExpand: () => void;
  expanded: boolean;
  /** Times a dragged key snaps to. */
  snapTimes: readonly number[];
  /** Index of the key a selected segment runs INTO, or null. */
  selectedSegment?: number | null;
  onSelectSegment?: (keyIndex: number) => void;
  /** A press on the lane that lands on no key, segment, or handle. */
  onPressEmpty?: () => void;
}

function entryTimes(row: LaneRow): number[] {
  if (row.kind === 'sampled') return (row.track as SampledTrack<unknown>).keys.map((k) => k.t);
  if (row.kind === 'event') return (row.track as EventTrack).events.map((e) => e.t);
  return [];
}

export function Lane(props: LaneProps): ReactElement {
  const {
    row, window: win, mode, selection, onSelect, onKeyInput, onKeyCommit, onInsert, onToggleExpand, expanded, snapTimes,
    selectedSegment = null, onSelectSegment, onPressEmpty, onKeysInput, onKeysCommit,
  } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const times = entryTimes(row);
  const { drag, msAt, onKeyPointerDown } = useKeyDrag({
    trackRef, window: win, offset: row.offset, snapTimes, times, onSelect, onKeyInput, onKeyCommit,
  });
  const pct = (ms: number): string => toPercent(win, ms + row.offset);

  // Only a numeric sampled row has an honest value axis to graph.
  const graph = mode === 'graph' && row.numeric;
  const sampledKeys = row.kind === 'sampled' ? (row.track as SampledTrack<number>).keys : [];

  const { keyEls, refocus } = useFocusFollowsKey(selection);

  const onKeyDown = (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const dx = arrowMove(e.key, e.shiftKey)?.dx ?? 0;
    if (dx !== 0) {
      e.preventDefault();
      refocus.current = true;
      onKeyCommit(i, Math.max(0, t + dx * KEY_STEP_MS));
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); }
    // The timeline deletes the selected key as this bubbles up; focus goes to the key selected after it.
    if (e.key === 'Delete' || e.key === 'Backspace') refocus.current = true;
  };

  return (
    <div className={s.lane} data-lane-key={row.key} data-depth={row.depth} data-mode={mode} data-graph={graph ? 'true' : undefined}>
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
            <DisclosureMark open={expanded} />
          </span>
        ) : null}
        {row.label}
      </div>
      <div
        className={s.laneTrack}
        ref={trackRef}
        data-testid="timeline-lane-track"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-keyframe-index], [data-handle-index], [data-segment-index]')) return;
          onPressEmpty?.();
        }}
        onDoubleClick={(e) => {
          if (row.kind !== 'sampled') return;
          if ((e.target as Element).closest('[data-keyframe-index], [data-handle-index]')) return;
          onInsert(msAt(e.clientX));
        }}
      >
        <AfterEnd end={row.end} win={win} />
        {graph ? (
          <LaneGraph
            keys={sampledKeys}
            label={row.label}
            window={win}
            offset={row.offset}
            snapTimes={snapTimes}
            selection={selection}
            selectedSegment={selectedSegment}
            onSelect={onSelect}
            onSelectSegment={onSelectSegment}
            onKeysInput={onKeysInput}
            onKeysCommit={(keys) => onKeysCommit?.(keys)}
          />
        ) : (
          <>
            {row.kind === 'timeline' ? (
              <div
                className={s.nestedBar}
                data-testid="timeline-nested"
                style={{ left: pct(0), width: spanPercent(win, (row.track as TimelineTrack).timeline.duration ?? 0) }}
              />
            ) : null}
            {row.kind === 'sampled' ? sampledKeys.slice(1).map((k, idx) => {
              const i = idx + 1;
              return (
                <div
                  key={`seg-${i}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${row.label} segment into ${Math.round(k.t)} ms`}
                  aria-current={selectedSegment === i ? 'true' : undefined}
                  data-testid="timeline-segment"
                  data-segment-index={i}
                  className={s.segment}
                  style={{ left: pct(sampledKeys[i - 1].t), width: spanPercent(win, k.t - sampledKeys[i - 1].t) }}
                  onClick={() => onSelectSegment?.(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment?.(i); } }}
                />
              );
            }) : null}
            {times.map((t, i) => (
              <div
                key={i}
                ref={(el) => { keyEls.current[i] = el; }}
                role="button"
                tabIndex={0}
                aria-label={`${row.label} key at ${Math.round(t)} ms`}
                aria-current={selection === i ? 'true' : undefined}
                data-testid={row.kind === 'event' ? 'timeline-event' : 'timeline-key'}
                data-keyframe-index={i}
                data-dragging={drag?.keyIndex === i ? 'true' : undefined}
                data-past={t + row.offset > row.end ? 'true' : undefined}
                className={row.kind === 'event' ? s.eventMark : s.key}
                style={{ left: pct(t) }}
                onPointerDown={onKeyPointerDown(i)}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={onKeyDown(i, t)}
              />
            ))}
            {drag ? <KeyGhost event={row.kind === 'event'} left={pct(drag.t)} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Where a dragged key would land, drawn over the committed key it moves from. */
function KeyGhost({ event, left }: { event: boolean; left: string }) {
  return <div aria-hidden="true" data-testid="timeline-key-ghost" className={event ? s.eventGhost : s.keyGhost} style={{ left }} />;
}

/** The stretch of a lane past where its timelines stop playing it. */
function AfterEnd({ end, win }: { end: number; win: TimeWindow }) {
  if (!(end < win.to)) return null;
  return <div aria-hidden="true" className={s.afterEnd} data-testid="timeline-after-end" style={{ left: toPercent(win, Math.max(end, win.from)), right: 0 }} />;
}

/** A keyboard move can re-sort the key to another index, and a delete selects another: set `refocus` and focus follows
 *  the selected key there once the lane renders. */
function useFocusFollowsKey(selection: number | null) {
  const keyEls = useRef<(HTMLDivElement | null)[]>([]);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    // Not from wherever focus went since: a key that asked for this may have changed nothing.
    const at = document.activeElement;
    if (at !== null && at !== document.body && !keyEls.current.includes(at as HTMLDivElement)) return;
    if (selection !== null) keyEls.current[selection]?.focus();
  });
  return { keyEls, refocus };
}
