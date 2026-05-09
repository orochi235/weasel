import { useCallback, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react';
import s from './RangePicker.module.css';

export type ThumbRenderCtx = {
  width: number;
  height: number;
  isActive: boolean;
};

export type ThumbShape =
  | 'round'
  | 'notched'
  | { render: (ctx: ThumbRenderCtx) => ReactNode };

export type Thumb = {
  value: number;
  label?: string;
  shape?: ThumbShape;
  bounds?: [number, number] | ((ctx: BoundsCtx) => [number, number]);
};

export type BoundsCtx = {
  thumbs: readonly Thumb[];
  index: number;
};

export type TrackCtx = {
  trackWidth: number;
  valueToFraction: (v: number) => number;
};

export type RangePickerProps<T extends Thumb = Thumb> = {
  thumbs: readonly T[];
  onChange: (next: T[]) => void;
  onCommit?: (next: T[]) => void;
  min: number;
  max: number;
  step?: number;
  constraint?: 'free' | 'ordered';
  onAddThumb?: (atValue: number) => T | null;
  onRemoveThumb?: (index: number) => boolean;
  allowShiftAll?: boolean;
  renderTrack?: (ctx: TrackCtx) => ReactNode;
  trackHeight?: number;
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

function defaultStep(step: number | undefined, min: number, max: number): number {
  if (step !== undefined && step > 0) return step;
  return (max - min) / 100;
}

function resolveBounds(thumb: Thumb, ctx: BoundsCtx, fallbackMin: number, fallbackMax: number): [number, number] {
  if (!thumb.bounds) return [fallbackMin, fallbackMax];
  const tuple = typeof thumb.bounds === 'function' ? thumb.bounds(ctx) : thumb.bounds;
  return [tuple[0], tuple[1]];
}

export function RangePicker<T extends Thumb = Thumb>(props: RangePickerProps<T>): ReactElement {
  const { thumbs, onChange, onCommit, min, max, step, constraint, trackHeight, ariaLabel, className } = props;

  const trackRef = useRef<HTMLDivElement | null>(null);
  // In-flight thumb buffer during a drag; null when not dragging.
  const dragBufferRef = useRef<T[] | null>(null);

  const valueToFraction = useCallback(
    (v: number): number => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1)),
    [min, max],
  );

  const fractionToValue = useCallback(
    (f: number): number => min + clamp(f, 0, 1) * (max - min),
    [min, max],
  );

  const beginThumbDrag = useCallback(
    (index: number) => {
      const buf: T[] = thumbs.map(t => ({ ...t }));
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

        const [bLo, bHi] = resolveBounds(buffer[index], { thumbs: buffer, index }, min, max);
        v = clamp(v, bLo, bHi);

        if (constraint === 'ordered') {
          const gap = step !== undefined && step > 0 ? step : (max - min) / 1000;
          const lower = index > 0 ? buffer[index - 1].value + gap : min;
          const upper = index < buffer.length - 1 ? buffer[index + 1].value - gap : max;
          v = clamp(v, lower, upper);
        }

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
        onChange(buffer.map(t => ({ ...t })));
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (!buffer) return;

        if (droppedOff && props.onRemoveThumb) {
          const accepted = props.onRemoveThumb(index);
          if (accepted) {
            const next = buffer.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
            onChange(next);
            onCommit?.(next);
            return;
          }
        }

        if (onCommit) onCommit(buffer.map(t => ({ ...t })));
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [thumbs, onChange, onCommit, fractionToValue, min, max, step, constraint, props],
  );

  const beginShiftAllDrag = useCallback(
    (anchorX: number) => {
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
        onChange(buffer.map(t => ({ ...t })));
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (buffer && onCommit) onCommit(buffer.map(t => ({ ...t })));
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [thumbs, onChange, onCommit, min, max, step],
  );

  const onThumbPointerDown = (index: number) => (e: ReactPointerEvent) => {
    // Only bail on explicit non-primary buttons (button > 0). jsdom's PointerEvent
    // leaves `button` undefined; treat that as primary so tests can drive drags.
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey && props.allowShiftAll) {
      beginShiftAllDrag(e.clientX);
    } else {
      beginThumbDrag(index);
    }
  };

  const onThumbContextMenu = (index: number) => (e: ReactMouseEvent) => {
    if (!props.onRemoveThumb) return;
    e.preventDefault();
    const accepted = props.onRemoveThumb(index);
    if (!accepted) return;
    const next = thumbs.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
    onChange(next);
    onCommit?.(next);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof e.button === 'number' && e.button > 0) return;
    if (!props.onAddThumb) return;
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
    const created = props.onAddThumb(v);
    if (!created) return;
    const next = [...thumbs.map(t => ({ ...t })), created] as T[];
    onChange(next);
    onCommit?.(next);
  };

  const onThumbKeyDown = (index: number) => (e: ReactKeyboardEvent) => {
    const stepSize = defaultStep(step, min, max);
    let delta = 0;
    let snapTo: 'home' | 'end' | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        delta = e.shiftKey ? stepSize * 10 : stepSize;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = e.shiftKey ? -stepSize * 10 : -stepSize;
        break;
      case 'PageUp':
        delta = stepSize * 10;
        break;
      case 'PageDown':
        delta = -stepSize * 10;
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
    else v = next[index].value + delta;
    v = snap(v, step, min);
    v = clamp(v, lo, hi);
    next[index] = { ...next[index], value: v };
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div
      className={className ? `${s.root} ${className}` : s.root}
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as CSSProperties) : undefined}
    >
      <div className={s.track} ref={trackRef} onPointerDown={onTrackPointerDown}>
        {thumbs.map((thumb, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-orientation="horizontal"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={thumb.value}
            aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
            className={s.thumb}
            style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
            onPointerDown={onThumbPointerDown(i)}
            onKeyDown={onThumbKeyDown(i)}
            onContextMenu={onThumbContextMenu(i)}
          >
            {thumb.label ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
