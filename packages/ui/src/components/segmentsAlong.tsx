import { Fragment, useId, useLayoutEffect, useState, type CSSProperties, type ReactElement, type RefObject } from 'react';
import { clamp, runStationAt, trackShapeD, type RunAlign, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { useRowRun } from './Along/useRowRun';
import { AlongContext } from './Along/alongContext';
import { useItemLengths, useRunGap } from './Along/useItemLengths';
import { RunBand, RunEnds, useRunRow } from './Along/useRunRow';
import type { SegmentedRowProps, SegmentPlace, SegmentState } from './segmentedRow';
import seg from './segmentedControl.module.css';
import s from './segmentsAlong.module.css';
import { cssPx } from '../cssPx';

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
  const run = useRowRun(root, shape);
  const lengths = useItemLengths(root, segments.map((segment) => segment.key), segmentKeyOf);
  const gap = useRunGap(root);
  const { pad, cap } = useWellEnds(root);
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
      {well && segments.length > 0 && <Well run={run} pad={pad} cap={cap} states={segments.map((segment) => segment.state)} stretches={stretches} />}
      <AlongContext.Provider value={null}>{wrap ? wrap(drawn) : drawn}</AlongContext.Provider>
      <RunEnds row={row} run={run} />
    </div>
  );
}

/** The shape fraction a point `d` px along `run` falls at. */
function shapeAt(run: TrackRun, d: number): number {
  return run.toShape(run.length > 0 ? clamp(d / run.length, 0, 1) : 0.5);
}

/** SVG path data for the stretch `lo..hi` px along `run`, carried on straight past either end of it. */
function stretchD(run: TrackRun, { lo, hi }: Stretch): string {
  const length = run.length;
  if (length <= 0) return trackShapeD(run.shape, shapeAt(run, lo), shapeAt(run, hi));
  const on = trackShapeD(run.shape, shapeAt(run, Math.max(lo, 0)), shapeAt(run, Math.min(hi, length)));
  const xy = (d: number): string => {
    const { x, y } = runStationAt(run, d).point;
    return `${x} ${y}`;
  };
  return `${lo < 0 ? `M ${xy(lo)} L` : 'M'}${on.slice(1)}${hi > length ? ` L ${xy(hi)}` : ''}`;
}

/** The well a curved row's segments sit in, stroked from the first segment on the run to the last and `pad` past each,
 *  with each lit segment's stretch stroked over it inside the well's rim. A lit segment at either end of the well runs on
 *  `cap` past it, under the rim's round cap, which the mask then cuts it to. */
function Well({ run, pad, cap, states, stretches }: { run: TrackRun; pad: number; cap: number; states: readonly SegmentState[]; stretches: readonly Stretch[] }): ReactElement {
  const mask = `wzl-well-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const last = stretches.length - 1;
  const shown = { lo: Math.max(stretches[0]!.lo, 0), hi: Math.min(stretches[last]!.hi, run.length) };
  const outer = { lo: shown.lo - pad, hi: shown.hi + pad };
  const lit = ({ lo, hi }: Stretch): Stretch | null =>
    hi <= shown.lo || lo >= shown.hi ? null : { lo: lo <= shown.lo ? outer.lo - cap : lo, hi: hi >= shown.hi ? outer.hi + cap : hi };
  return (
    <svg className={s.well} aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
          <path className={s.wellRim} d={stretchD(run, outer)} />
        </mask>
      </defs>
      <path className={s.wellTrack} d={stretchD(run, outer)} />
      <g mask={`url(#${mask})`}>
        {states.map((state, i) => {
          const stretch = state === 'off' ? null : lit(stretches[i]!);
          return stretch && <path key={i} className={state === 'on' ? s.lit : s.mixed} data-lit={state} d={stretchD(run, stretch)} />;
        })}
      </g>
    </svg>
  );
}

/** The well's ends in px, read once `root` is laid out and again when it or its first segment resizes: `pad`, its
 *  inline-start padding, is how far the well runs past its end segments, and `cap`, a segment's thickness, covers the
 *  rim's round cap. */
function useWellEnds(root: RefObject<HTMLElement | null>): { pad: number; cap: number } {
  const [pad, setPad] = useState(0);
  const [cap, setCap] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return;
    const segment = el.querySelector<HTMLElement>(`[${SEGMENT}]`);
    const measure = (): void => {
      setPad(cssPx(getComputedStyle(el).paddingInlineStart));
      setCap(segment?.offsetHeight ?? 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (segment) observer.observe(segment);
    return () => observer.disconnect();
  }, [root]);
  return { pad, cap };
}
