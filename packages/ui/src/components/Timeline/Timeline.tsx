import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { EasingSpec, Keyframe, SampledTrack, Track } from '@weasel-js/core';
import s from './Timeline.module.css';
import { EasingPicker } from './EasingPicker';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { Transport, type TransportProps } from './Transport';
import { buildLanes, trackAtPath } from './lanes';
import { deleteKey, insertKey, moveKey, samePath, setKeyEasing, setKeyValue, type KeySelection } from './keys';
import type { TimeWindow } from './timeScale';

export type { KeySelection } from './keys';
export type { TimeWindow } from './timeScale';

export interface KeyEditorCtx<T = unknown> {
  key: Keyframe<T>;
  track: SampledTrack<T>;
  selection: KeySelection;
  /** Replace the selected key; routed through this component's `onChange`. */
  commit: (next: Keyframe<T>) => void;
  /** Set the easing shaping the approach into this key. */
  setEasing: (easing: EasingSpec | undefined) => void;
}

export interface TimelineProps {
  tracks: readonly Track[];
  duration: number;
  playhead: number;

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

export function Timeline(props: TimelineProps): ReactElement {
  const {
    tracks, duration, playhead,
    onInput, onChange, onScrub,
    renderKeyEditor, label, className,
  } = props;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [ownWindow, setOwnWindow] = useState<TimeWindow>({ from: 0, to: duration });
  const [ownSelection, setOwnSelection] = useState<KeySelection | null>(null);
  const [segmentSelection, setSegmentSelection] = useState<KeySelection | null>(null);

  const win = props.window ?? ownWindow;
  const setWindow = props.onWindowChange ?? setOwnWindow;
  const selection = props.selection !== undefined ? props.selection : ownSelection;
  const setSelection = props.onSelect ?? setOwnSelection;

  const bounds: TimeWindow = { from: 0, to: duration };
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

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault();
      const r = deleteKey(tracks, selection);
      onChange(r.tracks);
      setSelection(r.selection);
    }
  };

  const selectedTrack = selection ? trackAtPath(tracks, selection.trackPath) : undefined;
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
            aria-checked={(props.mode ?? 'dope') === 'graph'}
            aria-label="Graph mode"
            className={s.transportButton}
            onClick={() => props.onModeChange?.((props.mode ?? 'dope') === 'graph' ? 'dope' : 'graph')}
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
              mode={props.mode ?? 'dope'}
              selection={selection && samePath(selection.trackPath, trackPath) ? selection.keyIndex : null}
              expanded={expanded.has(row.key)}
              snapTimes={snapTimes}
              onToggleExpand={() => toggle(row.key)}
              onSelect={(keyIndex) => setSelection({ trackPath, keyIndex })}
              onKeyInput={(keyIndex, toMs, value) => {
                if (!onInput) return;
                const r = moveKey(tracks, { trackPath, keyIndex }, toMs);
                onInput(value === undefined ? r.tracks : setKeyValue(r.tracks, r.selection!, value));
              }}
              onKeyCommit={(keyIndex, toMs, value) => {
                const r = moveKey(tracks, { trackPath, keyIndex }, toMs);
                onChange(value === undefined ? r.tracks : setKeyValue(r.tracks, r.selection!, value));
                setSelection(r.selection);
              }}
              onInsert={(atMs) => {
                const r = insertKey(tracks, trackPath, atMs);
                onChange(r.tracks);
                setSelection(r.selection);
              }}
              selectedSegment={segmentSelection && samePath(segmentSelection.trackPath, trackPath) ? segmentSelection.keyIndex : null}
              onSelectSegment={(keyIndex) => setSegmentSelection({ trackPath, keyIndex })}
              onEasingCommit={(keyIndex, easing) => {
                onChange(setKeyEasing(tracks, { trackPath, keyIndex }, easing));
              }}
            />
          );
        })}
      </div>

      {renderKeyEditor && selection && selectedKey && selectedTrack?.kind === 'sampled' ? (
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
