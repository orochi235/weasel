import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { cubicBezierEasing, type EasingSpec, type EventTrack, type SampledTrack, type TimelineTrack } from '@weasel-js/core';
import { ChevronIcon } from '../../icons';
import s from './Timeline.module.css';
import { createTimeScale, spanPercent, toFraction, toPercent, type TimeWindow } from './timeScale';
import { snapTime } from './keys';
import { easingBezier, sampleEasing } from './easingSpec';
import type { LaneRow } from './lanes';

/** Keeps the extreme keys inside the lane: at 0% a marker centres on the lane's
 *  border and hangs half into its neighbour. Symmetric, so the midpoint holds. */
const V_INSET_PCT = 8;

/** Snap radius, in track pixels. */
const SNAP_PX = 6;

/** One arrow-key step, in ms; shift multiplies by ten. */
const KEY_STEP_MS = 10;

/** Samples per segment when drawing an eased curve in graph mode. */
const CURVE_SAMPLES = 16;

export interface LaneProps {
  row: LaneRow;
  window: TimeWindow;
  mode: 'dope' | 'graph';
  /** Index of the selected key on THIS row, or null. */
  selection: number | null;
  onSelect: (keyIndex: number) => void;
  /** Live during a drag. `value` is set only in graph mode on a numeric row. */
  onKeyInput: (keyIndex: number, toMs: number, value?: number) => void;
  /** Once, at the end of a gesture. `value` is set only in graph mode on a numeric row. */
  onKeyCommit: (keyIndex: number, toMs: number, value?: number) => void;
  onInsert: (atMs: number) => void;
  onToggleExpand: () => void;
  expanded: boolean;
  /** Times a dragged key snaps to. */
  snapTimes: readonly number[];
  /** Index of the key a selected segment runs INTO, or null. */
  selectedSegment?: number | null;
  onSelectSegment?: (keyIndex: number) => void;
  /** Once, at the end of a bezier-handle drag. */
  onEasingCommit?: (keyIndex: number, easing: EasingSpec) => void;
}

/** `count` evenly spaced samples of a bezier curve, straight from its control
 *  points — not through `resolveEasing`. A drag writes a fresh set of control
 *  points on every pointermove, and `resolveEasing`'s cache is keyed by them:
 *  routing a live preview through it would leave one permanent cache entry per
 *  pixel of drag. Only the value committed on pointerup ever reaches it. */
function sampleBezierDirect(points: readonly [number, number, number, number], count: number): number[] {
  const fn = cubicBezierEasing(...points);
  const out = new Array<number>(count);
  const last = count - 1;
  for (let i = 0; i < count; i++) out[i] = fn(last === 0 ? 0 : i / last);
  return out;
}

function entryTimes(row: LaneRow): number[] {
  if (row.kind === 'sampled') return (row.track as SampledTrack<unknown>).keys.map((k) => k.t);
  if (row.kind === 'event') return (row.track as EventTrack).events.map((e) => e.t);
  return [];
}

export function Lane(props: LaneProps): ReactElement {
  const {
    row, window: win, mode, selection, onSelect, onKeyInput, onKeyCommit, onInsert, onToggleExpand, expanded, snapTimes,
    selectedSegment = null, onSelectSegment, onEasingCommit,
  } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { endDragRef.current?.(); }, []);

  // Live position of a bezier handle being dragged; null once the drag ends.
  // Distinct from the committed spec on the key so a preview never writes it.
  const [dragBezier, setDragBezier] = useState<{ keyIndex: number; points: readonly [number, number, number, number] } | null>(null);

  // Where the dragged key would land. Owned here rather than derived from the
  // tracks prop, so a drag previews whether or not the consumer wires
  // `onKeyInput` — the committed key stays put underneath as the origin.
  const [drag, setDrag] = useState<{ keyIndex: number; t: number; value?: number } | null>(null);

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

  // Value axis: only a numeric sampled row in graph mode has an honest one.
  const graph = mode === 'graph' && row.numeric;
  const sampledKeys = row.kind === 'sampled' ? (row.track as SampledTrack<number>).keys : [];
  const values = sampledKeys.map((k) => k.value);
  const lo = graph ? Math.min(...values) : 0;
  const hi = graph ? Math.max(...values) : 1;
  const vSpan = hi - lo || 1;
  const vPct = (v: number): number => V_INSET_PCT + ((v - lo) / vSpan) * (100 - 2 * V_INSET_PCT);

  const valueAt = (clientY: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return lo;
    const frac = 1 - (clientY - rect.top) / rect.height;
    const norm = (frac * 100 - V_INSET_PCT) / (100 - 2 * V_INSET_PCT);
    return lo + Math.min(1, Math.max(0, norm)) * vSpan;
  };

  const curvePoints = (): string => {
    const pts: string[] = [];
    for (let i = 1; i < sampledKeys.length; i++) {
      const a = sampledKeys[i - 1];
      const b = sampledKeys[i];
      const eased = dragBezier && dragBezier.keyIndex === i
        ? sampleBezierDirect(dragBezier.points, CURVE_SAMPLES)
        : sampleEasing(b.easing, CURVE_SAMPLES);
      for (let j = 0; j < eased.length; j++) {
        const t = a.t + ((b.t - a.t) * j) / (eased.length - 1);
        const v = a.value + (b.value - a.value) * eased[j];
        pts.push(`${toFraction(win, t + row.offset) * 100},${100 - vPct(v)}`);
      }
    }
    return pts.join(' ');
  };

  // The segment a bezier handle drags: the key it runs into and the one before it.
  const committedBezier = selectedSegment != null && row.kind === 'sampled'
    ? easingBezier(sampledKeys[selectedSegment]?.easing)
    : null;
  const activeBezier = dragBezier && dragBezier.keyIndex === selectedSegment ? dragBezier.points : committedBezier;

  const bezierHandlePos = (segIndex: number, xFrac: number, yFrac: number): { left: string; bottom: string } => {
    const a = sampledKeys[segIndex - 1];
    const b = sampledKeys[segIndex];
    const t = a.t + xFrac * (b.t - a.t);
    const v = a.value + yFrac * (b.value - a.value);
    return { left: pct(t), bottom: `${vPct(v)}%` };
  };

  const onHandlePointerDown = (segIndex: number, h: 0 | 1) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || !committedBezier) return;
    e.stopPropagation();
    const a = sampledKeys[segIndex - 1];
    const b = sampledKeys[segIndex];
    let points: [number, number, number, number] = [...committedBezier];

    const at = (ev: { clientX: number; clientY: number }): [number, number, number, number] => {
      const ms = msAt(ev.clientX);
      const xFrac = b.t === a.t ? 0 : Math.min(1, Math.max(0, (ms - a.t) / (b.t - a.t)));
      const v = valueAt(ev.clientY);
      const yFrac = b.value === a.value ? 0 : (v - a.value) / (b.value - a.value);
      const next = [...points] as [number, number, number, number];
      next[h * 2] = xFrac;
      next[h * 2 + 1] = yFrac;
      return next;
    };

    const move = (ev: PointerEvent): void => {
      points = at(ev);
      setDragBezier({ keyIndex: segIndex, points });
    };
    const up = (ev: PointerEvent): void => {
      points = at(ev);
      onEasingCommit?.(segIndex, { bezier: points });
      end();
    };
    const end = (): void => {
      setDragBezier(null);
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
    const valueOf = (ev: { clientY: number }): number | undefined =>
      graph ? valueAt(ev.clientY) : undefined;

    setDrag({ keyIndex: i, t: times[i], value: values[i] });

    const move = (ev: PointerEvent): void => {
      const v = valueOf(ev);
      setDrag({ keyIndex: i, t: at(ev), value: v ?? values[i] });
      if (v === undefined) onKeyInput(i, at(ev)); else onKeyInput(i, at(ev), v);
    };
    const up = (ev: PointerEvent): void => {
      const v = valueOf(ev);
      if (v === undefined) onKeyCommit(i, at(ev)); else onKeyCommit(i, at(ev), v);
      end();
    };
    const end = (): void => {
      setDrag(null);
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
    <div className={s.lane} data-depth={row.depth} data-mode={mode}>
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
        {graph && sampledKeys.length > 1 ? (
          <svg className={s.curve} data-testid="timeline-curve" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={curvePoints()} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
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
            style={graph ? { left: pct(t), bottom: `${vPct(values[i])}%` } : { left: pct(t) }}
            onPointerDown={onKeyPointerDown(i)}
            onKeyDown={onKeyDown(i, t)}
          />
        ))}
        {drag ? (
          <div
            aria-hidden="true"
            data-testid="timeline-key-ghost"
            className={row.kind === 'event' ? s.eventGhost : s.keyGhost}
            style={graph && drag.value !== undefined
              ? { left: pct(drag.t), bottom: `${vPct(drag.value)}%` }
              : { left: pct(drag.t) }}
          />
        ) : null}
        {graph && activeBezier && selectedSegment != null ? (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label={`${row.label} bezier handle 1`}
              data-testid="timeline-bezier-handle"
              className={s.bezierHandle}
              style={bezierHandlePos(selectedSegment, activeBezier[0], activeBezier[1])}
              onPointerDown={onHandlePointerDown(selectedSegment, 0)}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label={`${row.label} bezier handle 2`}
              data-testid="timeline-bezier-handle"
              className={s.bezierHandle}
              style={bezierHandlePos(selectedSegment, activeBezier[2], activeBezier[3])}
              onPointerDown={onHandlePointerDown(selectedSegment, 1)}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
