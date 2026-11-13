import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { EasingSpec } from '@weasel-js/core';
import { isEditableTarget } from '@weasel-js/gestures';
import type { Keyframe, SampledTrack, Track } from '@weasel-js/animator';
import s from './Timeline.module.css';
import { EasingPicker } from './EasingPicker';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { PlayheadReadout, Transport, type TransportProps } from './Transport';
import { buildLanes, trackAtPath, type LaneRow } from './lanes';
import { deleteKey, insertKey, moveKey, samePath, setKeyEasing, setKeys, setKeyValue, type KeySelection } from './keys';
import type { TimeWindow } from './timeScale';

export type { KeySelection } from './keys';
export type { TimeWindow } from './timeScale';

/** What `renderKeyEditor` is handed for the selected keyframe. */
export interface KeyEditorCtx<T = unknown> {
  key: Keyframe<T>;
  track: SampledTrack<T>;
  selection: KeySelection;
  /** Replace the selected key's value — `next`'s time and easing are ignored.
   *  Routed through this component's `onChange`. */
  commit: (next: Keyframe<T>) => void;
  /** Set the easing shaping the approach into this key. */
  setEasing: (easing: EasingSpec | undefined) => void;
}

/** Props for {@link Timeline}. Times are in ms. `mode`, `selection`, and
 *  `window` are controlled when given and held internally otherwise. */
export interface TimelineProps {
  tracks: readonly Track[];
  duration: number;
  playhead: number;

  /** Keys as marks on a row (`'dope'`, the default), or plotted as a value
   *  curve (`'graph'`) on rows whose values are numbers. */
  mode?: 'dope' | 'graph';
  onModeChange?: (mode: 'dope' | 'graph') => void;

  /** Live during a drag — wire for preview, do not write to history. */
  onInput?: (next: Track[]) => void;
  /** Committed at gesture end: one call per gesture. */
  onChange: (next: Track[]) => void;
  onScrub: (t: number) => void;

  /** The playback controls. Omitted, the row holds the time readout and the
   *  Graph switch alone; `false` hides the row. */
  transport?: Omit<TransportProps, 'playhead' | 'duration'> | false;
  selection?: KeySelection | null;
  onSelectionChange?: (sel: KeySelection | null) => void;
  renderKeyEditor?: (ctx: KeyEditorCtx) => ReactNode;

  window?: TimeWindow;
  onWindowChange?: (w: TimeWindow) => void;

  label?: ReactNode;
  className?: string;
}

/** A keyframe editor for a set of tracks: a ruler to scrub and zoom on, a
 *  lane per track, and a transport. Every edit comes back through `onChange`
 *  as a new track array; Delete or Backspace removes the selected key. */
export function Timeline(props: TimelineProps): ReactElement {
  const {
    tracks, duration, playhead,
    onInput, onChange, onScrub,
    renderKeyEditor, label, className,
  } = props;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Null until the user zooms in, so the window follows a duration that changes.
  const [ownWindow, setOwnWindow] = useState<TimeWindow | null>(null);
  const [selection, setSelection] = useHeld<KeySelection | null>(props.selection, null, props.onSelectionChange);
  const [mode, setMode] = useHeld<'dope' | 'graph'>(props.mode, 'dope', props.onModeChange);
  // By key index, so an edit that renumbers a track's keys drops it.
  const [segmentSelection, setSegmentSelection] = useState<KeySelection | null>(null);

  const bounds: TimeWindow = { from: 0, to: duration };
  const win = props.window ?? ownWindow ?? bounds;
  const setWindow = (w: TimeWindow): void => {
    if (props.window === undefined) setOwnWindow(w.from <= 0 && w.to >= duration ? null : w);
    props.onWindowChange?.(w);
  };
  // A key and a segment are one selection: taking either gives up the other.
  const selectKey = (sel: KeySelection | null): void => {
    setSelection(sel);
    setSegmentSelection(null);
  };
  const selectSegment = (sel: KeySelection): void => {
    setSegmentSelection(sel);
    if (selection) setSelection(null);
  };

  const rows = useMemo(() => buildLanes(tracks, expanded), [tracks, expanded]);

  const snapTimes = useMemo(() => snapTimesOf(rows, duration), [rows, duration]);

  const toggle = (key: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedTrack = selection ? trackAtPath(tracks, selection.trackPath) : undefined;

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.defaultPrevented || isEditableTarget(e.target)) return;
    if (e.key === 'Escape' && segmentSelection) {
      e.preventDefault();
      setSegmentSelection(null);
      return;
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const marked = markedKey(e.target as Element, rows);
    const target = marked === undefined ? selection : marked;
    if (target && trackAtPath(tracks, target.trackPath)?.kind === 'sampled') {
      e.preventDefault();
      const r = deleteKey(tracks, target);
      onChange(r.tracks);
      selectKey(r.selection);
    }
  };

  const selectedKey = selectedTrack?.kind === 'sampled'
    ? (selectedTrack as SampledTrack<unknown>).keys[selection!.keyIndex]
    : undefined;

  const segmentTrack = segmentSelection ? trackAtPath(tracks, segmentSelection.trackPath) : undefined;
  const segmentKey = segmentTrack?.kind === 'sampled'
    ? (segmentTrack as SampledTrack<unknown>).keys[segmentSelection!.keyIndex]
    : undefined;

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      data-testid="timeline-root"
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
    >
      {label ? <div className={s.label}>{label}</div> : null}

      {props.transport === false ? null : (
        <div className={s.transportRow}>
          {props.transport ? (
            <Transport {...props.transport} playhead={playhead} duration={duration} />
          ) : (
            <div className={s.transport}>
              <PlayheadReadout playhead={playhead} duration={duration} />
            </div>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={mode === 'graph'}
            aria-label="Graph mode"
            className={s.transportButton}
            onClick={() => {
              setMode(mode === 'graph' ? 'dope' : 'graph');
            }}
          >
            Graph
          </button>
        </div>
      )}

      <div className={s.body}>
        <div className={s.gutter} />
        <div className={s.rulerWrap}>
          <Ruler
            window={win}
            bounds={bounds}
            playhead={playhead}
            onScrub={onScrub}
            onWindowChange={setWindow}
          />
        </div>
      </div>

      <div className={s.lanes}>
        {rows.map((row) => {
          const trackPath = row.path;
          return (
            <Lane
              key={row.key}
              row={row}
              window={win}
              mode={mode}
              selection={selection && samePath(selection.trackPath, trackPath) ? selection.keyIndex : null}
              expanded={expanded.has(row.key)}
              snapTimes={snapTimes}
              onToggleExpand={() => toggle(row.key)}
              onSelect={(keyIndex) => selectKey({ trackPath, keyIndex })}
              onKeyInput={(keyIndex, toMs) => {
                onInput?.(moveKey(tracks, { trackPath, keyIndex }, toMs).tracks);
              }}
              onKeyCommit={(keyIndex, toMs) => {
                const r = moveKey(tracks, { trackPath, keyIndex }, toMs);
                onChange(r.tracks);
                selectKey(r.selection);
              }}
              onKeysInput={(keys) => onInput?.(setKeys(tracks, trackPath, keys))}
              onKeysCommit={(keys) => onChange(setKeys(tracks, trackPath, keys))}
              onInsert={(atMs) => {
                const r = insertKey(tracks, trackPath, atMs);
                onChange(r.tracks);
                selectKey(r.selection);
              }}
              selectedSegment={segmentSelection && samePath(segmentSelection.trackPath, trackPath) ? segmentSelection.keyIndex : null}
              onSelectSegment={(keyIndex) => selectSegment({ trackPath, keyIndex })}
              onPressEmpty={() => setSegmentSelection(null)}
            />
          );
        })}
      </div>

      {renderKeyEditor && !segmentSelection && selection && selectedKey && selectedTrack?.kind === 'sampled' ? (
        <div className={s.inspector}>
          {renderKeyEditor({
            key: selectedKey,
            track: selectedTrack as SampledTrack<unknown>,
            selection,
            commit: (next) => onChange(setKeyValue(tracks, selection, next.value)),
            setEasing: (easing) => onChange(setKeyEasing(tracks, selection, easing)),
          })}
        </div>
      ) : null}

      {segmentSelection && segmentKey ? (
        <div className={s.inspector}>
          <EasingPicker
            value={segmentKey.easing}
            onChange={(next) => onChange(setKeyEasing(tracks, segmentSelection, next))}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Every key time on every row — what a dragged key snaps to — and either end. */
function snapTimesOf(rows: readonly LaneRow[], duration: number): number[] {
  const out = new Set<number>([0, duration]);
  for (const row of rows) {
    if (row.kind === 'sampled') for (const k of (row.track as SampledTrack<unknown>).keys) out.add(k.t + row.offset);
  }
  return [...out];
}

/** The key whose mark `el` is in, `null` for a mark on no row drawn, or `undefined` when `el` is on no mark. */
function markedKey(el: Element, rows: readonly LaneRow[]): KeySelection | null | undefined {
  const mark = el.closest?.('[data-keyframe-index]');
  const lane = mark?.closest('[data-lane-key]');
  if (!mark || !lane) return undefined;
  const row = rows.find((r) => r.key === lane.getAttribute('data-lane-key'));
  return row ? { trackPath: row.path, keyIndex: Number(mark.getAttribute('data-keyframe-index')) } : null;
}

/** A value held here unless `given` is, reporting each change to `onChange` either way. */
function useHeld<T>(given: T | undefined, initial: T, onChange?: (next: T) => void): [T, (next: T) => void] {
  const [own, setOwn] = useState<T>(initial);
  const set = (next: T): void => {
    if (given === undefined) setOwn(next);
    onChange?.(next);
  };
  return [given !== undefined ? given : own, set];
}
