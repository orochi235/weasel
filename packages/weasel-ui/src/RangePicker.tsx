import type { CSSProperties, ReactElement, ReactNode } from 'react';
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

export function RangePicker<T extends Thumb = Thumb>(props: RangePickerProps<T>): ReactElement {
  const { thumbs, min, max, trackHeight, ariaLabel, className } = props;

  const valueToFraction = (v: number): number => {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (v - min) / (max - min)));
  };

  return (
    <div
      className={className ? `${s.root} ${className}` : s.root}
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as CSSProperties) : undefined}
    >
      <div className={s.track}>
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
          >
            {thumb.label ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
