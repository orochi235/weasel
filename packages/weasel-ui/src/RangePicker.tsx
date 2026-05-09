import { useCallback, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react';
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

export function RangePicker<T extends Thumb = Thumb>(props: RangePickerProps<T>): ReactElement {
  const { thumbs, onChange, onCommit, min, max, step, trackHeight, ariaLabel, className } = props;

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

      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const f = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        let v = fractionToValue(f);
        v = snap(v, step, min);
        v = clamp(v, min, max);
        buffer[index] = { ...buffer[index], value: v };
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
    [thumbs, onChange, onCommit, fractionToValue, min, max, step],
  );

  const onThumbPointerDown = (index: number) => (e: ReactPointerEvent) => {
    // Only bail on explicit non-primary buttons (button > 0). jsdom's PointerEvent
    // leaves `button` undefined; treat that as primary so tests can drive drags.
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    beginThumbDrag(index);
  };

  const onThumbKeyDown = (index: number) => (e: ReactKeyboardEvent) => {
    const stepSize = defaultStep(step, min, max);
    let delta = 0;
    let absoluteValue: number | null = null;

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
        absoluteValue = min;
        break;
      case 'End':
        absoluteValue = max;
        break;
      default:
        return;
    }

    e.preventDefault();
    const next = thumbs.map(t => ({ ...t }));
    const current = next[index].value;
    let v = absoluteValue ?? current + delta;
    v = snap(v, step, min);
    v = clamp(v, min, max);
    next[index] = { ...next[index], value: v };
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div
      className={className ? `${s.root} ${className}` : s.root}
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as CSSProperties) : undefined}
    >
      <div className={s.track} ref={trackRef}>
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
          >
            {thumb.label ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
