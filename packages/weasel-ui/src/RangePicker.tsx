import type { ReactElement, ReactNode } from 'react';
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

export function RangePicker<T extends Thumb = Thumb>(_props: RangePickerProps<T>): ReactElement {
  void _props;
  return <div className={s.root} />;
}
