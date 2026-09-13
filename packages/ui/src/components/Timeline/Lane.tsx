import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { openPointerSession, type EventTrack, type Keyframe, type PointerSession, type SampledTrack, type TimelineTrack } from '@weasel-js/core';
import { ChevronIcon } from '../../icons';
import s from './Timeline.module.css';
import { createTimeScale, spanPercent, toPercent, type TimeWindow } from './timeScale';
import { snapTime } from './keys';
import { LaneGraph } from './LaneGraph';
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
}

function entryTimes(row: LaneRow): number[] {
  if (row.kind === 'sampled') return (row.track as SampledTrack<unknown>).keys.map((k) => k.t);
  if (row.kind === 'event') return (row.track as EventTrack).events.map((e) => e.t);
  return [];
}

export function Lane(props: LaneProps): ReactElement {
  const {
    row, window: win, mode, selection, onSelect, onKeyInput, onKeyCommit, onInsert, onToggleExpand, expanded, snapTimes,
    selectedSegment = null, onSelectSegment, onKeysInput, onKeysCommit,
  } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  // Where the dragged key would land. Owned here rather than derived from the
  // tracks prop, so a drag previews whether or not the consumer wires
  // `onKeyInput` — the committed key stays put underneath as the origin.
  const [drag, setDrag] = useState<{ keyIndex: number; t: number } | null>(null);

  const pct = (ms: number): string => toPercent(win, ms + row.offset);

  const msAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return win.from;
    return createTimeScale(win, rect.width).toMs(clientX - rect.left) - row.offset;
  };

  const snapPxToMs = (): number => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    const scale = createTimeScale(win, width);
    return scale.toMs(SNAP_PX) - scale.toMs(0);
  };

  // Only a numeric sampled row has an honest value axis to graph.
  const graph = mode === 'graph' && row.numeric;
  const sampledKeys = row.kind === 'sampled' ? (row.track as SampledTrack<number>).keys : [];

  const onKeyPointerDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(i);

    // `snapTimes` are ruler times and `msAt` is track-local, so a nested row
    // has to cross into ruler space to snap and back out to commit.
    const at = (ev: { clientX: number; altKey: boolean }): number => {
      const raw = Math.max(0, msAt(ev.clientX));
      return ev.altKey ? raw : snapTime(raw + row.offset, snapTimes, snapPxToMs()) - row.offset;
    };

    setDrag({ keyIndex: i, t: times[i] });

    const end = (): void => {
      setDrag(null);
      sessionRef.current = null;
    };
    // No pointer capture — see `Ruler`, same idiom across the timeline.
    sessionRef.current?.cancel();
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        setDrag({ keyIndex: i, t: at(ev) });
        onKeyInput(i, at(ev));
      },
      onEnd: (ev) => {
        onKeyCommit(i, at(ev));
        end();
      },
      onCancel: end,
    }, { capture: false });
  };

  const onKeyDown = (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = KEY_STEP_MS * (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowRight') { e.preventDefault(); onKeyCommit(i, t + step); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onKeyCommit(i, Math.max(0, t - step)); }
  };

  const times = entryTimes(row);

  return (
    <div className={s.lane} data-depth={row.depth} data-mode={mode} data-graph={graph ? 'true' : undefined}>
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
            <ChevronIcon
              size={14}
              className={[s.disclosureIcon, !expanded && s.disclosureCollapsed].filter(Boolean).join(' ')}
            />
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
                role="button"
                tabIndex={0}
                aria-label={`${row.label} key at ${Math.round(t)} ms`}
                aria-current={selection === i ? 'true' : undefined}
                data-testid={row.kind === 'event' ? 'timeline-event' : 'timeline-key'}
                data-dragging={drag?.keyIndex === i ? 'true' : undefined}
                className={row.kind === 'event' ? s.eventMark : s.key}
                style={{ left: pct(t) }}
                onPointerDown={onKeyPointerDown(i)}
                onKeyDown={onKeyDown(i, t)}
              />
            ))}
            {drag ? (
              <div
                aria-hidden="true"
                data-testid="timeline-key-ghost"
                className={row.kind === 'event' ? s.eventGhost : s.keyGhost}
                style={{ left: pct(drag.t) }}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
