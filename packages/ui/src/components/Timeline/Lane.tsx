import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type RefObject } from 'react';
import { type Keyframe, type SampledTrack, type TimelineTrack } from '@weasel-js/animator';
import { DisclosureMark } from '../Disclosure';
import type { FocusHoldAttrs } from '../Disabled/controlHold';
import s from './Timeline.module.css';
import { spanPercent, toPercent, type TimeWindow } from './timeScale';
import { arrowMove } from '@weasel-js/quantity';
import { LaneGraph } from './LaneGraph';
import { rowTimes, timelineSpan, type LaneRow } from './lanes';
import { useKeyDrag } from './useKeyDrag';
import { KeyGhost, KeyMarks, SegmentMarks, type MarkHold } from './LaneMarks';

/** One arrow-key step, in ms; shift multiplies by ten. */
const KEY_STEP_MS = 10;

/** How the timeline's hold reaches a lane. */
export interface LaneHold {
  /** Keys move, insert, and delete. */
  edits: boolean;
  /** Keys and segments select, and the row folds. */
  looks: boolean;
  /** Every mark's: -1 takes them out of the tab order. */
  tabIndex: 0 | -1;
  /** On every mark. */
  focus: FocusHoldAttrs;
}

const FREE: LaneHold = { edits: true, looks: true, tabIndex: 0, focus: {} };

export interface LaneProps {
  row: LaneRow;
  window: TimeWindow;
  mode: 'dope' | 'graph';
  /** Index of the selected key on THIS row, or null. */
  selection: number | null;
  onSelectionChange: (keyIndex: number) => void;
  /** Live during a dope-sheet drag. */
  onKeyInput: (keyIndex: number, toMs: number) => void;
  /** A dope-sheet drag was canceled: hand back the tracks it began from. */
  onKeyRevert?: () => void;
  /** Once, at the end of a dope-sheet gesture. */
  onKeyChange: (keyIndex: number, toMs: number) => void;
  /** Live during a graph-mode key drag: the row's whole key list. */
  onKeysInput?: (keys: readonly Keyframe<number>[]) => void;
  /** Once per graph-mode edit: the row's whole key list. */
  onKeysChange?: (keys: readonly Keyframe<number>[]) => void;
  /** A drag in either mode was canceled, after its preview was put back. */
  onCancel?: () => void;
  onInsert: (atMs: number) => void;
  onExpandedChange: (next: boolean) => void;
  expanded: boolean;
  /** Times a dragged key snaps to. */
  snapTimes: readonly number[];
  /** Index of the key a selected segment runs INTO, or null. */
  selectedSegment?: number | null;
  onSelectSegment?: (keyIndex: number) => void;
  /** A press on the lane that lands on no key, segment, or handle. */
  onPressEmpty?: () => void;
  /** Default: nothing held. */
  hold?: LaneHold;
}

export function Lane(props: LaneProps): ReactElement {
  const {
    row, window: win, mode, selection, onKeyInput, onKeyChange, onInsert, expanded, snapTimes,
    selectedSegment = null, onPressEmpty, hold = FREE,
  } = props;
  const { onSelect, onSelectSegment, toggleExpanded, mark } = gated(props, hold);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const times = rowTimes(row);
  const { drag, msAt, onKeyPointerDown } = useKeyDrag({
    trackRef, window: win, offset: row.offset, snapTimes, times, onSelect, onKeyInput, onKeyChange, onRevert: props.onKeyRevert, onCancel: props.onCancel, drags: hold.edits,
  });
  const pct = (ms: number): string => toPercent(win, ms + row.offset);

  // Only a numeric sampled row has an honest value axis to graph.
  const graph = mode === 'graph' && row.numeric;
  const sampledKeys = row.kind === 'sampled' ? (row.track as SampledTrack<number>).keys : [];

  const refocusRef = useFocusFollowsKey(trackRef, selection);
  const deletes = hold.edits && row.kind === 'sampled';

  const onKeyDown = markKeys({ edits: hold.edits, onKeyChange, onSelect, refocus: refocusRef });

  return (
    <div className={s.lane} data-lane-key={row.key} data-depth={row.depth} data-mode={mode} data-graph={graph ? 'true' : undefined}>
      <LaneLabel row={row} mark={mark} expanded={expanded} toggleExpanded={toggleExpanded} />
      <div
        className={s.laneTrack}
        ref={trackRef}
        data-testid="timeline-lane-track"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-keyframe-index], [data-handle-index], [data-segment-index]')) return;
          onPressEmpty?.();
        }}
        onKeyDown={(e) => {
          // The timeline deletes the key as this bubbles up; focus goes to the key selected after it.
          if (deletes && (e.key === 'Delete' || e.key === 'Backspace') && (e.target as Element).closest('[data-keyframe-index]')) refocusRef.current = true;
        }}
        onDoubleClick={(e) => {
          if (row.kind !== 'sampled' || !hold.edits) return;
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
            onKeysInput={hold.edits ? props.onKeysInput : undefined}
            onKeysChange={(keys) => { if (hold.edits) props.onKeysChange?.(keys); }} onCancel={props.onCancel}
            edits={hold.edits}
          />
        ) : (
          <>
            {row.kind === 'timeline' ? <NestedBar track={row.track as TimelineTrack} offset={row.offset} win={win} /> : null}
            {row.kind === 'sampled' ? (
              <SegmentMarks
                keys={sampledKeys} label={row.label} offset={row.offset} win={win} pct={pct} mark={mark}
                selectedSegment={selectedSegment} onSelectSegment={onSelectSegment}
              />
            ) : null}
            <KeyMarks
              row={row} times={drag?.times ?? times} pct={pct} mark={mark} selection={selection} draggedIndex={drag?.keyIndex}
              onKeyPointerDown={onKeyPointerDown} onKeyDown={onKeyDown}
            />

            {drag ? <KeyGhost event={row.kind === 'event'} left={pct(drag.t)} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

const ignore = (): void => {};

/** The lane's presses that only choose or look, refused while it is disabled, and what each mark carries of the hold. */
function gated(props: LaneProps, hold: LaneHold) {
  return {
    onSelect: hold.looks ? props.onSelectionChange : ignore,
    onSelectSegment: hold.looks ? props.onSelectSegment : undefined,
    toggleExpanded: hold.looks ? () => props.onExpandedChange(!props.expanded) : ignore,
    mark: { tabIndex: hold.tabIndex, ...hold.focus },
  };
}

/** A key mark's keys: the arrows step it, unless the lane refuses edits, and Enter or Space selects it. `refocus` is
 *  set only for a key that will change, or a render for another reason would pull focus to the selected key. */
function markKeys({ edits, onKeyChange, onSelect, refocus }: {
  edits: boolean;
  onKeyChange: LaneProps['onKeyChange'];
  onSelect: (keyIndex: number) => void;
  refocus: { current: boolean };
}) {
  return (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const dx = arrowMove(e.key, e.shiftKey)?.dx ?? 0;
    if (dx !== 0 && edits) {
      e.preventDefault();
      const to = Math.max(0, t + dx * KEY_STEP_MS);
      if (to !== t) {
        refocus.current = true;
        onKeyChange(i, to);
      }
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); }
  };
}

/** The row's name, and for a nested timeline the disclosure that folds it. */
function LaneLabel({ row, mark, expanded, toggleExpanded }: {
  row: LaneRow;
  mark: MarkHold;
  expanded: boolean;
  toggleExpanded: () => void;
}) {
  const labelId = useId();
  return (
    <div className={s.laneLabel} style={{ '--depth': row.depth } as CSSProperties}>
      {row.kind === 'timeline' ? (
        <span
          role="button"
          {...mark}
          aria-labelledby={labelId}
          aria-expanded={expanded}
          data-testid="timeline-disclosure"
          className={s.disclosure}
          onClick={toggleExpanded}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }}
        >
          <DisclosureMark open={expanded} />
        </span>
      ) : null}
      <span id={labelId} className={s.laneName}>{row.label}</span>
    </div>
  );
}

/** A collapsed nested timeline's run on the ruler; an endless one runs off the window's end. */
function NestedBar({ track, offset, win }: { track: TimelineTrack; offset: number; win: TimeWindow }) {
  const start = offset + track.at;
  const span = Math.min(timelineSpan(track.timeline), Math.max(0, win.to - start));
  return <div className={s.nestedBar} data-testid="timeline-nested" style={{ left: toPercent(win, start), width: spanPercent(win, span) }} />;
}

/** The stretch of a lane past where its timelines stop playing it. */
function AfterEnd({ end, win }: { end: number; win: TimeWindow }) {
  if (!(end < win.to)) return null;
  return <div aria-hidden="true" className={s.afterEnd} data-testid="timeline-after-end" style={{ left: toPercent(win, Math.max(end, win.from)), right: 0 }} />;
}

/** A keyboard move can re-sort the key to another index, and a delete selects another: set `refocus` and focus follows
 *  the selected key there once the lane renders. */
function useFocusFollowsKey(trackRef: RefObject<HTMLDivElement | null>, selection: number | null) {
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const marks = trackRef.current?.querySelectorAll<HTMLElement | SVGElement>('[data-keyframe-index]');
    // Not from wherever focus went since: a key that asked for this may have changed nothing.
    const at = document.activeElement;
    if (at !== null && at !== document.body && ![...(marks ?? [])].includes(at as HTMLElement)) return;
    if (selection !== null) [...(marks ?? [])].find((m) => m.getAttribute('data-keyframe-index') === String(selection))?.focus();
  });
  return refocus;
}
