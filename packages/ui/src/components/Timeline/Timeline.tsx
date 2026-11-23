import { useMemo, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { EasingSpec } from '@weasel-js/geom';
import { isEditableTarget } from '@weasel-js/gestures';
import type { Keyframe, SampledTrack, Track } from '@weasel-js/animator';
import type { HoldProps } from '../Disabled';
import { useControlHold, type ControlHold } from '../Disabled/controlHold';
import s from './Timeline.module.css';
import { Lane, type LaneHold, type LaneProps } from './Lane';
import { TimeRuler } from './TimeRuler';
import { PlayheadReadout, Transport, type TransportProps } from '../Transport/Transport';
import { buildLanes, rowTimes, type LaneRow } from './lanes';
import { deleteKey, insertKey, keyTime, moveKey, samePath, setKeys, type KeyEdit, type KeySeed, type KeySelection } from './keys';
import type { TimeWindow } from './timeScale';
import { useFolds, useHeld, useKeyAndSegment, useKeyEditsHeldByPress, useTimeWindow } from './timelineState';
import { TimelineInspector } from './TimelineInspector';

export type { KeySeed, KeySelection } from './keys';
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
 *  `window` are controlled when given and held internally otherwise. Read-only, by `readOnly` or a scope, keys and
 *  segments still select, rows fold, and the view zooms, pans, and switches to the graph, but nothing scrubs or edits;
 *  disabled, nothing responds but focus, and with no reason anywhere the marks leave the tab order. */
export interface TimelineProps extends HoldProps {
  tracks: readonly Track[];
  duration: number;
  playhead: number;

  /** Keys as marks on a row (`'dope'`, the default), or plotted as a value
   *  curve (`'graph'`) on rows whose values are numbers. */
  mode?: 'dope' | 'graph';
  onModeChange?: (mode: 'dope' | 'graph') => void;

  /** The kit's edit protocol (`docs/conventions.md`, "Edit callbacks"): a key dragged, stepped or inserted, and a
   *  value or easing set, are each one edit. Escape cancels a drag. */
  onInput?: (next: Track[]) => void;
  onChange: (next: Track[]) => void;
  onCancel?: () => void;
  onSeek: (t: number) => void;

  /** The playback controls. Omitted, the row holds the time readout and the
   *  Graph switch alone; `false` hides the row. */
  transport?: Omit<TransportProps, 'playhead' | 'duration'> | false;
  selection?: KeySelection | null;
  onSelectionChange?: (sel: KeySelection | null) => void;
  renderKeyEditor?: (ctx: KeyEditorCtx) => ReactNode;
  /** The value of a key double-clicked onto an empty sampled track, or `undefined` to insert none. Default: the
   *  track's target's value, else 0 for a track with no `interpolate` or `interpolator`; one with either and no
   *  target takes no key, with a warning. */
  seedKey?: KeySeed;

  window?: TimeWindow;
  onWindowChange?: (w: TimeWindow) => void;

  label?: ReactNode;
  className?: string;
}

/** A keyframe editor for a set of tracks: a ruler to scrub and zoom on, a
 *  lane per track, and a transport. Every edit comes back through `onChange`
 *  as a new track array; Delete or Backspace removes the selected key. */
export function Timeline(props: TimelineProps): ReactElement {
  const { tracks, duration, playhead, onSeek, renderKeyEditor, label, className } = props;

  const hold = useControlHold(props, { readonlyRole: false });
  const { win, bounds, setWindow } = useTimeWindow(props.window, duration, props.onWindowChange);
  const { selection, segmentSelection, selectKey, selectSegment, dropSegment, send } = useKeyAndSegment(props.selection, tracks, props.onSelectionChange);
  const { expanded, toggle } = useFolds({ selection, segmentSelection, selectKey, dropSegment });
  const [mode, setMode] = useHeld<'dope' | 'graph'>(props.mode, 'dope', props.onModeChange);
  const pressHold = useKeyEditsHeldByPress();

  const rows = useMemo(() => buildLanes(tracks, expanded), [tracks, expanded]);

  const snapTimes = useMemo(() => snapTimesOf(rows, duration), [rows, duration]);


  const onInput = props.onInput && ((next: Track[]): void => {
    send(next);
    props.onInput?.(next);
  });
  const onChange = (next: Track[]): void => {
    send(next);
    props.onChange(next);
  };
  const commit = (r: KeyEdit): void => {
    onChange(r.tracks);
    selectKey(r.selection, r.tracks);
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.defaultPrevented || isEditableTarget(e.target)) return;
    if (e.key === 'Escape' && segmentSelection) {
      e.preventDefault();
      dropSegment();
      return;
    }
    if ((e.key !== 'Delete' && e.key !== 'Backspace') || hold.refuses || !onTimeline(e)) return;
    const marked = markedKey(e.target as Element, rows);
    const target = marked === undefined ? selection : marked;
    if (target && deletable(target, rows)) {
      e.preventDefault();
      commit(deleteKey(tracks, target));
    }
  };

  const edits = !hold.refuses;
  const laneHold: LaneHold = { edits, looks: !hold.disabled, tabIndex: hold.access.reachable ? 0 : -1, focus: hold.focus };
  return hold.wrap(hold.scope(
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      data-testid="timeline-root"
      data-held={hold.held}
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
      onKeyDownCapture={pressHold.onKeyDownCapture}
    >
      {label ? <div className={s.label}>{label}</div> : null}

      {props.transport === false ? null : (
        <TransportRow
          transport={props.transport} playhead={playhead} duration={duration} hold={hold}
          graph={mode === 'graph'} onGraphChange={(on) => setMode(on ? 'graph' : 'dope')}
        />
      )}

      <div className={s.body}>
        <div className={s.gutter} />
        <div className={s.rulerWrap}>
          <TimeRuler
            window={win}
            bounds={bounds}
            playhead={playhead}
            onSeek={edits ? onSeek : ignore}
            onWindowChange={hold.disabled ? undefined : setWindow}
          />
        </div>
      </div>

      <div className={s.lanes} onPointerDownCapture={pressHold.onPointerDownCapture}>
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
              limit={duration}
              hold={laneHold}
              onExpandedChange={() => toggle(row.key)}
              onSelectionChange={(keyIndex) => selectKey({ trackPath, keyIndex })}
              {...bindLaneEdits(tracks, trackPath, { onInput, onChange, commit }, props.seedKey)}
              onCancel={props.onCancel}
              selectedSegment={segmentSelection && samePath(segmentSelection.trackPath, trackPath) ? segmentSelection.keyIndex : null}
              onSelectSegment={(keyIndex) => selectSegment({ trackPath, keyIndex })}
              onPressEmpty={dropSegment}
            />
          );
        })}
      </div>

      <TimelineInspector
        tracks={tracks}
        selection={drawn(selection, rows)}
        segmentSelection={drawn(segmentSelection, rows)}
        renderKeyEditor={renderKeyEditor}
        edits={edits}
        onChange={onChange}
      />
    </div>,
  ));
}

const ignore = (): void => {};

/** A press on the root or the lanes, not on the transport, the Graph switch, or the inspector beside them. */
const onTimeline = (e: ReactKeyboardEvent): boolean =>
  e.target === e.currentTarget || Boolean((e.target as Element).closest?.('[data-lane-key]'));

/**
 * A lane's edits as edits to the whole track list: live ones through `onInput`, and finished ones through `onChange`,
 * or `commit` where the edit also moves the selection.
 */
function bindLaneEdits(tracks: readonly Track[], trackPath: readonly number[], report: {
  onInput?: (next: Track[]) => void;
  onChange: (next: Track[]) => void;
  commit: (r: KeyEdit) => void;
}, seed?: KeySeed): Pick<LaneProps, 'onKeyInput' | 'onKeyRevert' | 'onKeyChange' | 'onKeysInput' | 'onKeysChange' | 'onInsert'> {
  return {
    onKeyInput: (keyIndex, toMs) => report.onInput?.(moveKey(tracks, { trackPath, keyIndex }, toMs).tracks),
    onKeyRevert: () => report.onInput?.(tracks.slice()),
    onKeyChange: (keyIndex, toMs) => {
      const sel = { trackPath, keyIndex };
      if (keyTime(tracks, sel) === Math.max(0, toMs)) return;
      report.commit(moveKey(tracks, sel, toMs));
    },
    onKeysInput: (keys) => report.onInput?.(setKeys(tracks, trackPath, keys)),
    onKeysChange: (keys) => report.onChange(setKeys(tracks, trackPath, keys)),
    onInsert: (atMs) => {
      const r = insertKey(tracks, trackPath, atMs, seed);
      if (r.selection) report.commit(r);
    },
  };
}

/** The transport, or the time readout alone, and the Graph switch beside it. */
function TransportRow({ transport, playhead, duration, hold, graph, onGraphChange }: {
  transport: TimelineProps['transport'];
  playhead: number;
  duration: number;
  hold: ControlHold;
  graph: boolean;
  onGraphChange: (on: boolean) => void;
}): ReactElement {
  return (
    <div className={s.transportRow}>
      {transport ? (
        <Transport {...transport} playhead={playhead} duration={duration} />
      ) : (
        <div className={s.transport}>
          <PlayheadReadout playhead={playhead} duration={duration} />
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={graph}
        aria-label="Graph mode"
        className={s.transportButton}
        {...hold.button(false)}
        onClick={() => { if (!hold.disabled) onGraphChange(!graph); }}
      >
        Graph
      </button>
    </div>
  );
}

/** Every key and event time on every row drawn — what a dragged key snaps to — and either end. */
function snapTimesOf(rows: readonly LaneRow[], duration: number): number[] {
  const out = new Set<number>([0, duration]);
  for (const row of rows) {
    for (const t of rowTimes(row)) out.add(t + row.offset);
  }
  return [...out];
}

/** `sel` when it is on a row that is drawn: one on a row folded away edits nothing, as Delete deletes nothing for it. */
function drawn(sel: KeySelection | null, rows: readonly LaneRow[]): KeySelection | null {
  return sel && rows.some((r) => samePath(r.path, sel.trackPath)) ? sel : null;
}

/** Whether `sel` names a key that exists on a sampled row that is drawn. */
function deletable(sel: KeySelection, rows: readonly LaneRow[]): boolean {
  const row = rows.find((r) => samePath(r.path, sel.trackPath));
  return row?.kind === 'sampled' && sel.keyIndex >= 0 && sel.keyIndex < (row.track as SampledTrack<unknown>).keys.length;
}

/** The key whose mark `el` is in, `null` for a mark on no row drawn, or `undefined` when `el` is on no mark. */
function markedKey(el: Element, rows: readonly LaneRow[]): KeySelection | null | undefined {
  const mark = el.closest?.('[data-keyframe-index]');
  const lane = mark?.closest('[data-lane-key]');
  if (!mark || !lane) return undefined;
  const row = rows.find((r) => r.key === lane.getAttribute('data-lane-key'));
  return row ? { trackPath: row.path, keyIndex: Number(mark.getAttribute('data-keyframe-index')) } : null;
}
