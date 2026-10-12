import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { EasingSpec } from '@weasel-js/core';
import { isEditableTarget } from '@weasel-js/gestures';
import type { Keyframe, SampledTrack, Track } from '@weasel-js/animator';
import s from './Timeline.module.css';
import { EasingPicker } from './EasingPicker';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { Transport, type TransportProps } from './Transport';
import { buildLanes, trackAtPath } from './lanes';
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

  /** `false` hides the transport. */
  transport?: Omit<TransportProps, 'playhead' | 'duration'> | false;
  selection?: KeySelection | null;
  onSelect?: (sel: KeySelection | null) => void;
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
  const [ownSelection, setOwnSelection] = useState<KeySelection | null>(null);
  const [ownMode, setOwnMode] = useState<'dope' | 'graph'>('dope');
  // By key index, so an edit that renumbers a track's keys drops it.
  const [segmentSelection, setSegmentSelection] = useState<KeySelection | null>(null);

  const bounds: TimeWindow = { from: 0, to: duration };
  const win = props.window ?? ownWindow ?? bounds;
  const setWindow = props.onWindowChange
    ?? ((w: TimeWindow): void => setOwnWindow(w.from <= 0 && w.to >= duration ? null : w));
  const selection = props.selection !== undefined ? props.selection : ownSelection;
  const setSelection = props.onSelect ?? setOwnSelection;
  // A key and a segment are one selection: taking either gives up the other.
  const selectKey = (sel: KeySelection | null): void => {
    setSelection(sel);
    setSegmentSelection(null);
  };
  const selectSegment = (sel: KeySelection): void => {
    setSegmentSelection(sel);
    if (selection) setSelection(null);
  };
  const mode = props.mode ?? ownMode;

  const rows = useMemo(() => buildLanes(tracks, expanded), [tracks, expanded]);

  /** Every key time on every row — what a dragged key snaps to. */
  const snapTimes = useMemo(() => {
    const out = new Set<number>([0, duration]);
    for (const row of rows) {
      if (row.kind === 'sampled') for (const k of (row.track as SampledTrack<unknown>).keys) out.add(k.t + row.offset);
    }
    return [...out];
  }, [rows, duration]);

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
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection && selectedTrack?.kind === 'sampled') {
      e.preventDefault();
      const r = deleteKey(tracks, selection);
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
          <Transport
            {...(props.transport ?? {
              paused: true, loop: false, rate: 1,
              onPlay: () => {}, onPause: () => {},
              onLoopChange: () => {}, onRateChange: () => {},
            })}
            playhead={playhead}
            duration={duration}
          />
          <button
            type="button"
            role="switch"
            aria-checked={mode === 'graph'}
            aria-label="Graph mode"
            className={s.transportButton}
            onClick={() => {
              const next = mode === 'graph' ? 'dope' : 'graph';
              setOwnMode(next);
              props.onModeChange?.(next);
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
