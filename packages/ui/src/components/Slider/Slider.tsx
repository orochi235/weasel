import { useCallback, useEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/core';
import s from './Slider.module.css';
import { formatNumber } from '../../format/number';

/**
 * Passed to a custom thumb renderer: the thumb box in CSS px, and whether
 * this thumb is the one being dragged.
 */
export type ThumbRenderCtx = {
  width: number;
  height: number;
  isActive: boolean;
};

/**
 * A thumb's appearance — one of the two built-in shapes, or a custom
 * renderer.
 */
export type ThumbShape =
  | 'round'
  | 'notched'
  | { render: (ctx: ThumbRenderCtx) => ReactNode };

/**
 * One handle on a {@link Slider}. `bounds` narrows the range this particular
 * thumb may move within, either fixed or computed from the current thumb
 * list.
 */
export type Thumb = {
  value: number;
  label?: string;
  shape?: ThumbShape;
  bounds?: [number, number] | ((ctx: BoundsCtx) => [number, number]);
  /**
   * Spoken form of `value`, published as `aria-valuetext`. Required by ARIA
   * whenever `value` is not the quantity the user is choosing — an index into
   * a value list, a log-scaled position — since `aria-valuenow` alone then
   * announces a number that means nothing.
   */
  valueText?: string;
};

/**
 * Passed to a thumb's `bounds` function: the full thumb list and this thumb's
 * index in it, so a bound can be expressed relative to its neighbors.
 */
export type BoundsCtx = {
  thumbs: readonly Thumb[];
  index: number;
};

/**
 * Passed to `renderTrack`: the track's width in CSS px and a mapping from a
 * slider value to its 0..1 position along the track.
 */
export type TrackCtx = {
  trackWidth: number;
  valueToFraction: (v: number) => number;
};

/**
 * Props for {@link Slider}.
 *
 * `onInput` fires continuously through a drag; `onChange` fires once when it
 * ends and is the one to write to history.
 *
 * `stops` are attractors: a drag that passes within a few pixels of one lands
 * on it, and the arrow keys move stop to stop. `step` still quantizes the
 * values between them. Each one is drawn on the track as a mark; pass
 * `showStops: false` for a track whose own paint already reads as the stops.
 *
 * `trackClick: 'move-nearest'` makes a press on bare track send the closest
 * thumb there and continue as a drag. It is off by default because on a
 * multi-thumb editor a stray click would yank a stop the user was not aiming
 * at; `onAddThumb`, where it is set, keeps the track press.
 *
 * `constraint: 'ordered'` keeps thumbs from crossing each other. Supplying
 * `onAddThumb` makes a click on empty track create a thumb, and supplying
 * `onRemoveThumb` lets a right-click or a drag off the track remove one —
 * both callbacks can decline by returning `null`/`false`. `allowShiftAll`
 * makes shift-drag translate every thumb together.
 */
export type SliderProps<T extends Thumb = Thumb> = {
  thumbs: readonly T[];
  onInput: (next: T[]) => void;
  onChange?: (next: T[]) => void;
  min: number;
  max: number;
  step?: number;
  stops?: number[];
  showStops?: boolean;
  trackClick?: 'none' | 'move-nearest';
  constraint?: 'free' | 'ordered';
  onAddThumb?: (atValue: number) => T | null;
  onRemoveThumb?: (index: number) => boolean;
  allowShiftAll?: boolean;
  renderTrack?: (ctx: TrackCtx) => ReactNode;
  trackHeight?: number;
  /** `'slim'` drives the track and thumb from the kit's slider tokens, so a
   *  Slider matches the property rows. `trackHeight` still wins if given. */
  density?: 'default' | 'slim';
  renderReadout?: (thumb: T, index: number) => ReactNode;
  readoutPlacement?: 'none' | 'inline-after' | 'below-thumb';
  ariaLabel?: string;
  className?: string;
};

function snap(v: number, step: number | undefined, min: number): number {
  if (step === undefined || step <= 0) return v;
  return Math.round((v - min) / step) * step + min;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** How close a drag has to come to a stop, in track pixels, to land on it. */
const STOP_SNAP_PX = 8;

/** A custom `ThumbShape.render` may put interactive content inside the thumb,
 *  and capture would retarget pointerup and kill the click on it. */
const NO_CAPTURE = { capture: false } as const;

/** The stops that are actually reachable: inside the range, deduped, ascending. */
function usableStops(stops: number[] | undefined, min: number, max: number): number[] {
  if (!stops || stops.length === 0) return [];
  return [...new Set(stops.filter(v => v >= min && v <= max))].sort((a, b) => a - b);
}

/** Pull `v` onto the nearest stop within `tolerance`, or leave it where it is. */
function attract(v: number, stops: number[], tolerance: number): number {
  let best = v;
  let bestGap = tolerance;
  for (const stop of stops) {
    const gap = Math.abs(stop - v);
    if (gap <= bestGap) {
      best = stop;
      bestGap = gap;
    }
  }
  return best;
}

/** The stop `count` places past `v` in `direction`, saturating at either end. */
function stepStops(stops: number[], v: number, direction: 1 | -1, count: number): number {
  if (direction > 0) {
    const first = stops.findIndex(stop => stop > v);
    if (first === -1) return stops[stops.length - 1];
    return stops[Math.min(stops.length - 1, first + count - 1)];
  }
  let first = -1;
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i] < v) {
      first = i;
      break;
    }
  }
  if (first === -1) return stops[0];
  return stops[Math.max(0, first - (count - 1))];
}

function defaultStep(step: number | undefined, min: number, max: number): number {
  if (step !== undefined && step > 0) return step;
  return (max - min) / 100;
}

/** Keep a thumb inside its neighbors when `constraint` is `'ordered'`. */
function clampOrdered(
  v: number,
  thumbs: readonly Thumb[],
  index: number,
  min: number,
  max: number,
  step: number | undefined,
): number {
  const gap = step !== undefined && step > 0 ? step : (max - min) / 1000;
  const lower = index > 0 ? thumbs[index - 1].value + gap : min;
  const upper = index < thumbs.length - 1 ? thumbs[index + 1].value - gap : max;
  return clamp(v, lower, upper);
}

function resolveBounds(thumb: Thumb, ctx: BoundsCtx, fallbackMin: number, fallbackMax: number): [number, number] {
  if (!thumb.bounds) return [fallbackMin, fallbackMax];
  const tuple = typeof thumb.bounds === 'function' ? thumb.bounds(ctx) : thumb.bounds;
  return [tuple[0], tuple[1]];
}

function defaultReadout(thumb: Thumb): string {
  return formatNumber(thumb.value, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/**
 * Multi-thumb slider over a shared track. The thumb list is fully controlled:
 * every change, live or committed, arrives as a whole new array.
 *
 * Thumbs are draggable, and arrow/Home/End move the focused thumb — those
 * keystrokes fire `onInput` and `onChange` together, since there is no
 * in-flight state to buffer.
 */
export function Slider<T extends Thumb = Thumb>(props: SliderProps<T>): ReactElement {
  const { thumbs, onInput, onChange, min, max, step, constraint, trackHeight, density, ariaLabel, className } = props;

  const stops = usableStops(props.stops, min, max);

  const trackRef = useRef<HTMLDivElement | null>(null);
  // In-flight thumb buffer during a drag; null when not dragging.
  const dragBufferRef = useRef<T[] | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);

  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  const valueToFraction = useCallback(
    (v: number): number => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1)),
    [min, max],
  );

  const fractionToValue = useCallback(
    (f: number): number => min + clamp(f, 0, 1) * (max - min),
    [min, max],
  );

  // `seed` replaces the thumb list the drag starts from. A track press moves a
  // thumb before the drag begins, and without seeding, a release with no
  // movement would commit the stale buffer and undo that move.
  const beginThumbDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, index: number, seed?: readonly T[]) => {
      sessionRef.current?.cancel();
      const buf: T[] = (seed ?? thumbs).map(t => ({ ...t }));
      dragBufferRef.current = buf;
      let droppedOff = false;

      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const f = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        let v = fractionToValue(f);
        v = snap(v, step, min);
        v = clamp(v, min, max);
        if (stops.length > 0) v = attract(v, stops, (STOP_SNAP_PX / rect.width) * (max - min));

        const [bLo, bHi] = resolveBounds(buffer[index], { thumbs: buffer, index }, min, max);
        v = clamp(v, bLo, bHi);

        if (constraint === 'ordered') v = clampOrdered(v, buffer, index, min, max, step);

        // Drop-off detection: pointer exits the track vertically by more than trackHeight.
        const bandHeight = rect.height;
        if (props.onRemoveThumb) {
          if (ev.clientY < rect.top - bandHeight || ev.clientY > rect.bottom + bandHeight) {
            droppedOff = true;
          } else {
            droppedOff = false;
          }
        }

        buffer[index] = { ...buffer[index], value: v };
        onInput(buffer.map(t => ({ ...t })));
      };

      // A drag that ends without a release — cancelled pointer, lost capture,
      // an unmount — drops the buffer without committing.
      const onCancel = () => {
        sessionRef.current = null;
        dragBufferRef.current = null;
      };

      const onEnd = () => {
        sessionRef.current = null;
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (!buffer) return;

        if (droppedOff && props.onRemoveThumb) {
          const accepted = props.onRemoveThumb(index);
          if (accepted) {
            const next = buffer.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
            onInput(next);
            onChange?.(next);
            return;
          }
        }

        onChange?.(buffer.map(t => ({ ...t })));
      };

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, onChange, fractionToValue, min, max, step, stops, constraint, props],
  );

  const beginShiftAllDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, anchorX: number) => {
      sessionRef.current?.cancel();
      const buf: T[] = thumbs.map(t => ({ ...t }));
      const startValues = buf.map(t => t.value);
      dragBufferRef.current = buf;

      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const dxFraction = (ev.clientX - anchorX) / rect.width;
        let dValue = dxFraction * (max - min);
        dValue = snap(dValue, step, 0);

        // Clamp delta so no thumb leaves [min, max] (per-thumb bounds intentionally
        // not enforced — matches the experiment's hue-band shift-translate semantics).
        let allowedNeg = -Infinity;
        let allowedPos = Infinity;
        for (let i = 0; i < startValues.length; i++) {
          allowedNeg = Math.max(allowedNeg, min - startValues[i]);
          allowedPos = Math.min(allowedPos, max - startValues[i]);
        }
        dValue = clamp(dValue, allowedNeg, allowedPos);

        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = { ...buffer[i], value: clamp(startValues[i] + dValue, min, max) };
        }
        onInput(buffer.map(t => ({ ...t })));
      };

      const onCancel = () => {
        sessionRef.current = null;
        dragBufferRef.current = null;
      };

      const onEnd = () => {
        sessionRef.current = null;
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (buffer) onChange?.(buffer.map(t => ({ ...t })));
      };

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, onChange, min, max, step],
  );

  const onThumbPointerDown = (index: number) => (e: ReactPointerEvent) => {
    // Only bail on explicit non-primary buttons (button > 0). jsdom's PointerEvent
    // leaves `button` undefined; treat that as primary so tests can drive drags.
    if (typeof e.button === 'number' && e.button > 0) return;
    // preventDefault below suppresses the focus the press would otherwise
    // give the thumb, and the arrow keys are on the thumb.
    (e.currentTarget as HTMLElement).focus?.();
    e.preventDefault();
    e.stopPropagation();
    const origin = e.currentTarget as HTMLElement;
    if (e.shiftKey && props.allowShiftAll) {
      beginShiftAllDrag(origin, e, e.clientX);
    } else {
      beginThumbDrag(origin, e, index);
    }
  };

  const onThumbContextMenu = (index: number) => (e: ReactMouseEvent) => {
    if (!props.onRemoveThumb) return;
    e.preventDefault();
    const accepted = props.onRemoveThumb(index);
    if (!accepted) return;
    const next = thumbs.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
    onInput(next);
    onChange?.(next);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof e.button === 'number' && e.button > 0) return;
    const wantsMove = (props.trackClick ?? 'none') === 'move-nearest' && thumbs.length > 0;
    if (!props.onAddThumb && !wantsMove) return;
    // If the event originated on a thumb, the thumb's own handler ran first; this is a track click.
    if ((e.target as HTMLElement).closest(`.${s.thumb}`)) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const f = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    let v = fractionToValue(f);
    v = snap(v, step, min);
    v = clamp(v, min, max);
    if (stops.length > 0) v = attract(v, stops, (STOP_SNAP_PX / rect.width) * (max - min));

    if (props.onAddThumb) {
      const created = props.onAddThumb(v);
      if (!created) return;
      const next = [...thumbs.map(t => ({ ...t })), created] as T[];
      onInput(next);
      onChange?.(next);
      return;
    }

    let index = 0;
    for (let i = 1; i < thumbs.length; i++) {
      if (Math.abs(thumbs[i].value - v) < Math.abs(thumbs[index].value - v)) index = i;
    }
    const next = thumbs.map(t => ({ ...t })) as T[];
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    let moved = clamp(v, bLo, bHi);
    if (constraint === 'ordered') moved = clampOrdered(moved, next, index, min, max, step);
    next[index] = { ...next[index], value: moved };
    onInput(next);
    beginThumbDrag(track, e, index, next);
  };

  const onThumbKeyDown = (index: number) => (e: ReactKeyboardEvent) => {
    const stepSize = defaultStep(step, min, max);
    let delta = 0;
    // With stops, a keystroke moves by whole stops rather than by value.
    let stopDelta = 0;
    let snapTo: 'home' | 'end' | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        delta = e.shiftKey ? stepSize * 10 : stepSize;
        stopDelta = e.shiftKey ? 10 : 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = e.shiftKey ? -stepSize * 10 : -stepSize;
        stopDelta = e.shiftKey ? -10 : -1;
        break;
      case 'PageUp':
        delta = stepSize * 10;
        stopDelta = 10;
        break;
      case 'PageDown':
        delta = -stepSize * 10;
        stopDelta = -10;
        break;
      case 'Home':
        snapTo = 'home';
        break;
      case 'End':
        snapTo = 'end';
        break;
      default:
        return;
    }

    e.preventDefault();
    const next = thumbs.map(t => ({ ...t }));
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    const lo = Math.max(min, bLo);
    const hi = Math.min(max, bHi);
    let v: number;
    if (snapTo === 'home') v = lo;
    else if (snapTo === 'end') v = hi;
    else if (stops.length > 0) {
      v = stepStops(stops, next[index].value, stopDelta > 0 ? 1 : -1, Math.abs(stopDelta));
    } else {
      v = snap(next[index].value + delta, step, min);
    }
    v = clamp(v, lo, hi);
    if (constraint === 'ordered') v = clampOrdered(v, next, index, lo, hi, step);
    next[index] = { ...next[index], value: v };
    onInput(next);
    onChange?.(next);
  };

  const placement = props.readoutPlacement ?? 'none';
  const renderReadout = props.renderReadout;

  const slim = density === 'slim';
  const rootVars: Record<string, string> = {};
  if (slim) {
    rootVars['--rp-track-height'] = 'var(--wzl-slider-track-h)';
    rootVars['--rp-thumb-size'] = 'var(--wzl-slider-thumb-size)';
  }
  // An explicit trackHeight wins: a caller who named a number meant it.
  if (trackHeight !== undefined) rootVars['--rp-track-height'] = `${trackHeight}px`;
  const rootClass = [s.root, slim && s.slim, className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={Object.keys(rootVars).length > 0 ? (rootVars as CSSProperties) : undefined}
    >
      <div className={s.row}>
      <div className={s.track} ref={trackRef} onPointerDown={onTrackPointerDown}>
        {props.renderTrack && (
          <div className={s.trackInner}>
            {props.renderTrack({
              trackWidth: trackRef.current?.getBoundingClientRect().width ?? 0,
              valueToFraction,
            })}
          </div>
        )}
        {(props.showStops ?? true) && stops.length > 0 && (
          <div className={s.ticks} data-slider-ticks aria-hidden="true">
            {stops.map(v => {
              const f = valueToFraction(v);
              return (
                <span
                  key={v}
                  className={s.tick}
                  data-slider-tick
                  data-fraction={String(f)}
                  style={{ left: `${f * 100}%` }}
                />
              );
            })}
          </div>
        )}
        {thumbs.map((thumb, i) => {
          const isNotched = thumb.shape === 'notched';
          const customRender = typeof thumb.shape === 'object' && thumb.shape !== null ? thumb.shape.render : null;
          const cls = `${s.thumb}${isNotched ? ` ${s.notched}` : ''}`;
          return (
            <div
              key={i}
              role="slider"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={thumb.value}
              aria-valuetext={thumb.valueText}
              aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
              className={cls}
              style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
              onPointerDown={onThumbPointerDown(i)}
              onKeyDown={onThumbKeyDown(i)}
              onContextMenu={onThumbContextMenu(i)}
            >
              {customRender ? customRender({ width: 14, height: 24, isActive: false }) : (thumb.label ?? '')}
            </div>
          );
        })}
      </div>
      {placement === 'inline-after' && (
        <span data-readout="inline" className={s.readoutInline}>
          {thumbs.map((t, i) => (
            <span key={i}>{i > 0 ? ' / ' : ''}{renderReadout ? renderReadout(t, i) : defaultReadout(t)}</span>
          ))}
        </span>
      )}
      </div>
      {placement === 'below-thumb' && (
        <div className={s.readoutsBelow}>
          {thumbs.map((t, i) => (
            <span
              key={i}
              data-readout="below"
              className={s.readoutBelow}
              style={{ left: `${valueToFraction(t.value) * 100}%` }}
            >
              {renderReadout ? renderReadout(t, i) : defaultReadout(t)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
