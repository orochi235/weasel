import { Fragment, useId, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactElement, type RefObject } from 'react';
import { clamp, trackRun, trackShapeD, type RunAlign, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { AlongContext } from './Along/alongContext';
import { useItemLengths, useRunGap } from './Along/useItemLengths';
import { RunBand, RunEnds, useRunRow } from './Along/useRunRow';
import type { SegmentedRowProps, SegmentPlace, SegmentState } from './segmentedRow';
import seg from './segmentedControl.module.css';
import s from './segmentsAlong.module.css';

const SEGMENT = 'data-segment';
const segmentKeyOf = (child: Element): string | null => child.getAttribute(SEGMENT);

/** Props for {@link SegmentsAlong}: a segmented row's, with the shape it lies along settled. */
export interface SegmentsAlongProps extends SegmentedRowProps {
  shape: TrackShape;
  align: RunAlign;
}

/** A stretch of the run, in px along it. */
interface Stretch {
  lo: number;
  hi: number;
}

/**
 * A segmented row laid along a curved track shape: each segment centered on its spot and tipped to it, edge to edge.
 * The default variant strokes its well along the run behind them and its lit segments as stretches of that well, masked
 * to the well's rounded ends; `'flat'` and `'minimal'` keep each segment's own box. A row too long for its run scrolls
 * along it.
 */
export function SegmentsAlong(props: SegmentsAlongProps): ReactElement {
  const { roving, role, ariaLabel, className, height, size, variant = 'default', segments, wrap, shape, align } = props;
  const root = roving.rootRef;
  const run = useMemo(() => trackRun(shape), [shape]);
  const lengths = useItemLengths(root, segments.map((segment) => segment.key), segmentKeyOf);
  const gap = useRunGap(root);
  const pad = useInlinePad(root);
  const sizes = segments.map((segment) => lengths.get(segment.key) ?? 0);
  const row = useRunRow({ root, keyOf: segmentKeyOf, run, lengths: sizes, gap, align });
  const well = variant === 'default';

  const stretches: Stretch[] = segments.map((_, i) => {
    const center = row.place(i).at * run.length;
    return { lo: center - (sizes[i] ?? 0) / 2, hi: center + (sizes[i] ?? 0) / 2 };
  });
  const place = (i: number): SegmentPlace => {
    const at = row.place(i);
    const segment = segments[i]!;
    return { className: at.className, style: at.style, 'data-clipped': at.clipped, 'data-segment': segment.key, 'data-state': segment.state, drawsState: well };
  };
  const style = height !== undefined ? ({ '--tb-h': `${height}px` } as CSSProperties) : undefined;
  const rootCls = [s.root, size && seg[`size_${size}`], variant !== 'default' && seg[`variant_${variant}`], className].filter(Boolean).join(' ');
  const drawn = segments.map((segment, i) => <Fragment key={segment.key}>{segment.draw(place(i))}</Fragment>);

  return (
    <div ref={root as RefObject<HTMLDivElement>} onKeyDown={roving.onKeyDown} {...row.rootProps} className={rootCls} role={role} aria-label={ariaLabel} style={style} data-shape={shape.kind} data-variant={variant} data-size={size}>
      <RunBand row={row} shape={shape} />
      {well && segments.length > 0 && <Well run={run} pad={pad} states={segments.map((segment) => segment.state)} stretches={stretches} />}
      <AlongContext.Provider value={null}>{wrap ? wrap(drawn) : drawn}</AlongContext.Provider>
      <RunEnds row={row} run={run} />
    </div>
  );
}

/** The shape fraction a point `d` px along `run` falls at. */
function shapeAt(run: TrackRun, d: number): number {
  const g = run.length > 0 ? clamp(d / run.length, 0, 1) : 0.5;
  return run.reversed ? run.to - g * (run.to - run.from) : run.from + g * (run.to - run.from);
}

/** SVG path data for the stretch `lo..hi` px along `run`, cut to the run. */
function stretchD(run: TrackRun, { lo, hi }: Stretch): string {
  return trackShapeD(run.shape, shapeAt(run, lo), shapeAt(run, hi));
}

/** The well a curved row's segments sit in, stroked along the run from the first segment to the last and `pad` past
 *  each, with each lit segment's stretch stroked over it inside the well's rim. */
function Well({ run, pad, states, stretches }: { run: TrackRun; pad: number; states: readonly SegmentState[]; stretches: readonly Stretch[] }): ReactElement {
  const mask = `wzl-well-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const last = stretches.length - 1;
  const outer = { lo: stretches[0]!.lo - pad, hi: stretches[last]!.hi + pad };
  // An end segment's stroke runs on under the rim's round cap, which the mask then cuts it to.
  const lit = (i: number): Stretch => ({ lo: i === 0 ? -Infinity : stretches[i]!.lo, hi: i === last ? Infinity : stretches[i]!.hi });
  return (
    <svg className={s.well} aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
          <path className={s.wellRim} d={stretchD(run, outer)} />
        </mask>
      </defs>
      <path className={s.wellTrack} d={stretchD(run, outer)} />
      <g mask={`url(#${mask})`}>
        {states.map((state, i) => (state === 'off' ? null : <path key={i} className={state === 'on' ? s.lit : s.mixed} data-lit={state} d={stretchD(run, lit(i))} />))}
      </g>
    </svg>
  );
}

/** `root`'s inline-start padding in px, read once it is laid out and again when it resizes: the well's rim. */
function useInlinePad(root: RefObject<HTMLElement | null>): number {
  const [pad, setPad] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return;
    const measure = (): void => setPad(Number.parseFloat(getComputedStyle(el).paddingInlineStart) || 0);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);
  return pad;
}
