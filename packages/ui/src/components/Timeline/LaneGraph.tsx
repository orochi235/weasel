import { useMemo, useRef, useState, type ReactElement } from 'react';
import { useElementSize, useLatest } from '@weasel-js/core';
import { type Keyframe } from '@weasel-js/animator';
import { maxOf, minOf } from '@weasel-js/geom';
import { LayeredCurveEditor } from '../CurveEditor/LayeredCurveEditor';
import { applyKeyframeDrag, type KeyframeLayerState } from '../CurveEditor/createKeyframeLayer';
import { KeyframeLayer } from '../CurveEditor/KeyframeLayer';
import s from './Timeline.module.css';
import { TICK_SPACING_PX, windowScale, type TimeWindow } from './timeScale';

/** Keeps the extreme keys inside the lane: at the very edge a key centers on
 *  the lane's border and hangs half into its neighbor. As a percentage of
 *  the lane's height, applied top and bottom. */
const V_INSET_PCT = 8;

/** One arrow-key step, in ms; shift multiplies by ten. */
const KEY_STEP = { x: 10 };
const TRACK_TIME = [0, Infinity] as const;
const formatMs = (t: number): string => `${Math.round(t)} ms`;

export interface LaneGraphProps {
  keys: readonly Keyframe<number>[];
  label: string;
  window: TimeWindow;
  /** Ruler time of this track's zero. */
  offset: number;
  /** Ruler times a dragged key snaps to. */
  snapTimes: readonly number[];
  selection: number | null;
  selectedSegment: number | null;
  onSelect: (keyIndex: number) => void;
  onSelectSegment?: (keyIndex: number) => void;
  /** Live during a key drag. */
  onKeysInput?: (keys: readonly Keyframe<number>[]) => void;
  /** Once per edit: a drag's end, a handle's release, a key press. */
  onKeysCommit: (keys: readonly Keyframe<number>[]) => void;
  /** False: keys and segments still select, and nothing drags or steps. Default true. */
  edits?: boolean;
}

/** The value range a lane plots: its keys' extent, padded so no key sits on
 *  the border. A flat track gets a unit span so it still has a middle. */
function valueRange(keys: readonly Keyframe<number>[]): [number, number] {
  const values = keys.map((k) => k.value);
  const lo = minOf(values);
  const hi = maxOf(values);
  const span = hi - lo || 1;
  const pad = (span * V_INSET_PCT) / (100 - 2 * V_INSET_PCT);
  return [lo - pad, lo + span + pad];
}

/** A numeric lane's graph: one keyframe layer on a curve editor, sized to the
 *  lane and windowed to the ruler. */
export function LaneGraph(props: LaneGraphProps): ReactElement {
  const {
    keys, label, window: win, offset, snapTimes, selection, selectedSegment,
    onSelect, onSelectSegment, onKeysInput, onKeysCommit, edits = true,
  } = props;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(hostRef);

  // The layer works in track time; the snap candidates are ruler times.
  const snapX = useMemo(() => snapTimes.map((t) => t - offset), [snapTimes, offset]);

  const committed = useMemo<KeyframeLayerState>(
    () => ({ keys, selectedKey: selection, selectedSegment, drag: null }),
    [keys, selection, selectedSegment],
  );
  // Held only while a gesture is in flight, so a consumer echoing live input
  // back through `keys` cannot move the keys out from under the drag.
  const [live, setLive] = useState<KeyframeLayerState | null>(null);
  const state = live ?? committed;
  const stateRef = useLatest(state);

  const onLayerChange = (next: KeyframeLayerState): void => {
    const prev = stateRef.current;
    if (next.selectedKey !== null && next.selectedKey !== prev.selectedKey) onSelect(next.selectedKey);
    if (next.selectedSegment !== null && next.selectedSegment !== prev.selectedSegment) onSelectSegment?.(next.selectedSegment);
    if (!next.drag || !edits) { setLive(null); return; }
    setLive(next);
    // A handle drag writes a fresh easing spec per move; publishing those
    // would grow the consumer's easing cache by one entry per pixel.
    if (next.drag.kind !== 'key') return;
    const applied = applyKeyframeDrag(next).keys;
    if (applied !== next.keys) onKeysInput?.(applied);
  };

  const onLayerCommit = (next: KeyframeLayerState, prev: KeyframeLayerState): void => {
    setLive(null);
    if (edits && next.keys !== prev.keys) onKeysCommit(next.keys);
  };

  const [yLo, yHi] = valueRange(state.keys);
  const ticks = windowScale(win, size.width).spacedTicks({ minSpacing: TICK_SPACING_PX }).values;

  return (
    <div ref={hostRef} className={s.graphHost}>
      {size.width > 0 && size.height > 0 ? (
        <LayeredCurveEditor
          className={s.graph}
          aria-label={`${label} graph`}
          width={size.width}
          height={size.height}
          xRange={[win.from - offset, win.to - offset]}
          yRange={[yLo, yHi]}
          grid={false}
          axes={false}
          // The ruler's ticks, carried into track time.
          xTicks={{ values: ticks.map((t) => t - offset), labels: false }}
          // Clears a key at the track's start edge, which hangs into the gutter.
          yTicks={{ labels: 'outside', gap: 10 }}
          history={false}
        >
          <KeyframeLayer
            id="keys"
            label={label}
            formatX={formatMs}
            snapX={snapX}
            xClamp={TRACK_TIME}
            step={KEY_STEP}
            state={state}
            onChange={onLayerChange}
            onCommit={onLayerCommit}
          />
        </LayeredCurveEditor>
      ) : null}
    </div>
  );
}
