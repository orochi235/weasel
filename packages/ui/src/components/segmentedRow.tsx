import { Fragment, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { RovingTabIndex } from '../useRovingTabIndex';
import { useTrackShape } from './Along/alongContext';
import { SegmentsAlong } from './segmentsAlong';
import type { SegmentedSize, SegmentedVariant } from './segmentedVariant';
import s from './segmentedControl.module.css';

/** Whether a segment is on, off, or mixed: its sources disagree. */
export type SegmentState = 'off' | 'on' | 'mixed';

/** Where a segment of a curved row goes, and how it marks its state there. */
export interface SegmentPlace {
  className: string;
  style: CSSProperties;
  'data-clipped'?: string;
  'data-segment': string;
  'data-state': SegmentState;
  /** The row draws the segment's state itself, so the segment wears no state class. */
  drawsState: boolean;
}

/** One segment of a {@link SegmentedRow}: its key and state, and how to draw its button wherever it lands. */
export interface Segment {
  key: string;
  state: SegmentState;
  draw: (place: SegmentPlace | undefined) => ReactElement;
}

/** Props for {@link SegmentedRow}. */
export interface SegmentedRowProps {
  roving: RovingTabIndex;
  role: string;
  ariaLabel?: string;
  className?: string;
  height?: number;
  size?: SegmentedSize;
  variant?: SegmentedVariant;
  segments: readonly Segment[];
  /** Wraps the segments, for a context they read. */
  wrap?: (segments: ReactNode) => ReactNode;
}

/** A segment button's class: the segment's, its state's unless the row draws that itself, and its place's. */
export function segmentClassName(state: SegmentState, place: SegmentPlace | undefined): string {
  const shown = place?.drawsState ? 'off' : state;
  return [s.segment, shown === 'on' && s.segmentSelected, shown === 'mixed' && s.segmentMixed, place?.className].filter(Boolean).join(' ');
}

/** The props a segment button spreads beside its class: what puts it on a curved row. */
export function segmentPlaceProps(place: SegmentPlace | undefined): Partial<Omit<SegmentPlace, 'className' | 'drawsState'>> {
  if (place === undefined) return {};
  const { className: _c, drawsState: _d, ...rest } = place;
  return rest;
}

/**
 * The row `ToggleBar`, `ButtonBar` and `OptionsBar` draw their segments in: a pill-shaped well on a straight line, or
 * inside a curved `Along`, segments laid along its run with the well and the lit segments stroked along it.
 */
export function SegmentedRow(props: SegmentedRowProps): ReactElement {
  const along = useTrackShape();
  if (along !== null && along.shape.kind !== 'line') return <SegmentsAlong {...props} shape={along.shape} align={along.align} />;
  const { roving, role, ariaLabel, className, height, size, variant, segments, wrap } = props;
  const style = height !== undefined ? ({ '--tb-h': `${height}px` } as CSSProperties) : undefined;
  const rootCls = [s.root, size && s[`size_${size}`], variant && s[`variant_${variant}`], className].filter(Boolean).join(' ');
  const drawn = segments.map((segment) => <Fragment key={segment.key}>{segment.draw(undefined)}</Fragment>);
  return (
    <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} className={rootCls} role={role} aria-label={ariaLabel} style={style}>
      {wrap ? wrap(drawn) : drawn}
    </div>
  );
}
