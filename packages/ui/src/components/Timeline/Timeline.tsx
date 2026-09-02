import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { EasingSpec, Keyframe, SampledTrack, Track } from '@weasel-js/core';
import s from './Timeline.module.css';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { Transport, type TransportProps } from './Transport';
import { buildLanes, type LaneRow } from './lanes';
import { deleteKey, insertKey, moveKey, setKeyEasing, setKeyValue, type KeySelection } from './keys';
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

/** The flat index a lane row occupies among the top-level tracks, or -1 for a
 *  nested row. Editing a nested track's keys is a later change; nested rows are
 *  read-only for now and their keys do not drag. */
function topLevelIndex(row: LaneRow): number {
  return row.path.length === 1 ? row.path[0] : -1;
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

  const selectedTrack = selection ? tracks[selection.trackIndex] : undefined;
  const selectedKey = selectedTrack?.kind === 'sampled'
    ? (selectedTrack as SampledTrack<unknown>).keys[selection!.keyIndex]
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
        <Transport
          {...(props.transport ?? {
            paused: true, loop: false, rate: 1,
            onPlay: () => {}, onPause: () => {},
            onLoopChange: () => {}, onRateChange: () => {},
          })}
          playhead={playhead}
          duration={duration}
        />
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
          const ti = topLevelIndex(row);
          return (
            <Lane
              key={row.key}
              row={row}
              window={win}
              mode={props.mode ?? 'dope'}
              selection={selection && selection.trackIndex === ti ? selection.keyIndex : null}
              expanded={expanded.has(row.key)}
              snapTimes={snapTimes}
              onToggleExpand={() => toggle(row.key)}
              onSelect={(keyIndex) => { if (ti >= 0) setSelection({ trackIndex: ti, keyIndex }); }}
              onKeyInput={(keyIndex, toMs) => {
                if (ti < 0 || !onInput) return;
                onInput(moveKey(tracks, { trackIndex: ti, keyIndex }, toMs).tracks);
              }}
              onKeyCommit={(keyIndex, toMs) => {
                if (ti < 0) return;
                const r = moveKey(tracks, { trackIndex: ti, keyIndex }, toMs);
                onChange(r.tracks);
                setSelection(r.selection);
              }}
              onInsert={(atMs) => {
                if (ti < 0) return;
                const r = insertKey(tracks, ti, atMs);
                onChange(r.tracks);
                setSelection(r.selection);
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
    </div>
  );
}
