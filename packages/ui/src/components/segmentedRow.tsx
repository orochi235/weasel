import { Fragment, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { RovingTabIndex } from '../useRovingTabIndex';
import { useRun, type Orientation } from './Run';
import { SegmentsAlong } from './segmentsAlong';
import type { SegmentedSize, SegmentedVariant } from './segmentedVariant';
import s from './segmentedControl.module.css';
import type { LastRow, SelectState, Tiling } from '@weasel-js/ui-input';
import { tiling } from '../tiling';

/** Whether a segment is on, off, or mixed: its sources disagree. */
export type SegmentState = SelectState;

/** Where a segment of a curved row goes, and how it marks its state there. */
export interface SegmentPlace {
  className: string;
  style: CSSProperties;
  'data-clipped'?: string;
  'data-segment': string;
  'data-state': SegmentState;
  /** The row draws the segment's state itself, so the segment wears no state class. */
  drawsState: boolean;
  /** Anything else a layout reads off the segment: a tiled row's `data-tile-corners`, say. */
  [attr: `data-${string}`]: string | undefined;
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
  /** Which way the row runs. Defaults to the way the row it sits in runs. */
  orientation?: Orientation;
  /** Wraps the segments, for a context they read. */
  wrap?: (segments: ReactNode) => ReactNode;
  /** Lays the segments out as a grid in one well, rounded at the grid's outer corners. A curved `Along` still bends
   *  the row into one line. */
  tiling?: Tiling;
}

/** What a segmented bar takes to wrap its segments into a grid in one well. */
export interface SegmentedGridProps {
  /** Segments per row. Omitted, the bar is one line. */
  columns?: number;
  /** With `columns`, where a short last row sits, or `'fill'` to stretch it across the row. Default `'start'`. */
  lastRow?: LastRow;
}

/** The tiling `props` ask for, or `undefined` for a bar on one line, a curved `Along` bending it into one whatever
 *  `columns` says. Hand it to `SegmentedRow` and, through `tilingRoving`, to the bar's `useRovingTabIndex`. */
export function useSegmentedTiling(props: SegmentedGridProps): Tiling | undefined {
  const { shape } = useRun();
  if (shape !== undefined && shape.kind !== 'line') return undefined;
  return props.columns ? { columns: props.columns, lastRow: props.lastRow } : undefined;
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
  const enclosing = useRun();
  if (enclosing.shape !== undefined && enclosing.shape.kind !== 'line') return <SegmentsAlong {...props} shape={enclosing.shape} align={enclosing.align ?? 'center'} />;
  const { roving, role, ariaLabel, className, height, size, variant, segments, wrap } = props;
  const tiles = props.tiling ? tiling(segments.length, props.tiling) : null;
  const style = {
    ...tiles?.style,
    ...(height !== undefined ? { '--tb-h': `${height}px` } : {}),
  } as CSSProperties;
  const rootCls = [s.root, tiles && `${tiles.className} ${s.tiled}`, size && s[`size_${size}`], variant && s[`variant_${variant}`], className]
    .filter(Boolean).join(' ');
  const orientation = props.orientation ?? enclosing.orientation;
  const placeOf = (segment: Segment, i: number): SegmentPlace | undefined => tiles
    ? { className: '', style: {}, 'data-segment': segment.key, 'data-state': segment.state, drawsState: false, ...tiles.item(i) }
    : undefined;
  const drawn = segments.map((segment, i) => <Fragment key={segment.key}>{segment.draw(placeOf(segment, i))}</Fragment>);
  return (
    <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} className={rootCls} role={role} aria-label={ariaLabel} data-orientation={orientation} style={style}>
      {wrap ? wrap(drawn) : drawn}
    </div>
  );
}
