import { useRef, type CSSProperties, type FocusEvent as ReactFocusEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type RefObject } from 'react';
import { placeAlongRun, runLength, runStationAt, trackShapeD, type RunAlign, type RunPlace, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { placeStyle } from './placeOnRun';
import type { RunItemsOf, RunKeyOf } from './useItemLengths';
import { useRunScroll } from './useRunScroll';
import { useRunText } from './runText';
import s from './runRow.module.css';

/** What a run too long for its track does: `'scroll'` along itself, or `'center'` on the track and stay put. */
export type RunOverflow = 'scroll' | 'center';

/** What {@link useRunRow} reads. */
export interface RunRowArgs {
  root: RefObject<HTMLElement | null>;
  /** Which of the root's children lie on the run, in run order: those it reads a key off. */
  keyOf: RunKeyOf;
  /** Where under the root the items are found. Default: its own children. */
  itemsOf?: RunItemsOf;
  run: TrackRun;
  /** Each item's length along the run, in run order. */
  lengths: readonly number[];
  gap: number;
  align: RunAlign;
  /** Default `'scroll'`. */
  overflow?: RunOverflow;
  /** Whether a press with Cmd, or Ctrl off Apple platforms, is left to a reorder rather than scrolling the row. */
  modReorders?: boolean;
}

/** Where one item of a run row goes: the class and style that put it there, and its center as a share of the run. */
export interface RunItemPlace {
  className: string;
  style: CSSProperties;
  clipped: RunPlace['clipped'] | undefined;
  at: number;
}

/** A row of items laid along a run, as {@link useRunRow} places them. */
export interface RunRow {
  place(index: number): RunItemPlace;
  /** Spread on the row's root, whose class composes `root` from `runRow.module.css`: the handlers that scroll it. */
  rootProps: {
    'data-scrolls': '' | undefined;
    onPointerDownCapture: (e: ReactPointerEvent) => void;
    onFocusCapture: (e: ReactFocusEvent) => void;
  };
  scrolls: boolean;
  /** Whether items lie past the run's start and its end, so {@link RunEnds} marks them. */
  past: { start: boolean; end: boolean };
  /** The {@link RunBand} drawn while the row scrolls, which pointers are measured through. */
  band: RefObject<SVGSVGElement | null>;
}

/**
 * Items laid along `run`, each centered on its spot and tipped to it, `gap` apart. A row too long for its run scrolls
 * along it, its items fading as they slide off either end and kept focusable past it, or with `overflow: 'center'`
 * sits centered on it. Every item is a child of `root` that `keyOf` reads a key off, drawn in run order.
 */
export function useRunRow({ root, keyOf, itemsOf, run, lengths, gap, align, overflow = 'scroll', modReorders }: RunRowArgs): RunRow {
  const band = useRef<SVGSVGElement>(null);
  const scrolling = overflow === 'scroll';
  const total = scrolling ? runLength(lengths, gap) : 0;
  let spots: RunPlace[] = [];
  const scroll = useRunScroll({ root, keyOf, itemsOf, frame: band, run, total, spots: () => spots, lengths, modReorders });
  useRunText(root, run);
  spots = placeAlongRun(run, lengths, { gap, align, offset: scrolling ? scroll.offset : Math.max(0, (runLength(lengths, gap) - run.length) / 2), past: 'hold' });
  // A zero-length run has no direction to carry items along: they all sit at its one point.
  const flat = run.length <= 0;
  const place = (i: number): RunItemPlace => {
    const spot = spots[i]!;
    const style: CSSProperties = placeStyle(flat ? run.at(0.5) : spot);
    if (scrolling && !flat) Object.assign(style, { '--along-shown': shownOf(spot.center, lengths[i] ?? 0, run.length) });
    return { className: s.item!, style, clipped: scrolling ? spot.clipped : undefined, at: flat ? 0.5 : spot.center / run.length };
  };
  const scrolls = total > run.length;
  return {
    place,
    rootProps: { 'data-scrolls': scrolls ? '' : undefined, onPointerDownCapture: scroll.onPointerDownCapture, onFocusCapture: scroll.onFocusCapture },
    scrolls,
    past: { start: scroll.offset > 0, end: total - scroll.offset > run.length },
    band,
  };
}

/** The share of an item `length` long centered at `center` that lies on a run `room` long: its opacity as it slides off. */
export function shownOf(center: number, length: number, room: number): number {
  if (length <= 0) return center >= 0 && center <= room ? 1 : 0;
  const lo = center - length / 2;
  const on = Math.min(room, lo + length) - Math.max(0, lo);
  return Math.max(0, Math.min(1, on / length));
}

/** The run itself, as wide as the row, drawn while it scrolls so a press between items still drags it along. */
export function RunBand({ row, shape }: { row: RunRow; shape: TrackShape }): ReactElement | null {
  if (!row.scrolls) return null;
  return (
    <svg className={s.band} aria-hidden="true" ref={row.band}>
      <path className={s.bandPath} d={trackShapeD(shape)} />
    </svg>
  );
}

/** Px a chevron sits out past its run's end, clear of the item fading there. */
const MORE_PAST_OUT = 10;

/** A chevron at each end of a scrolled run that has items past it, pointing out along the run. */
export function RunEnds({ row, run }: { row: RunRow; run: TrackRun }): ReactElement | null {
  if (!row.scrolls) return null;
  // The chevron glyph points down, a quarter turn clockwise from the reading direction `angle` tips to.
  const mark = (at: 'start' | 'end') => {
    const style = placeStyle(runStationAt(run, at === 'start' ? -MORE_PAST_OUT : run.length + MORE_PAST_OUT, 0, 'follow'), at === 'start' ? 90 : -90);
    return (
      <span className={s.morePast} data-more-past={at} aria-hidden="true" style={style}>
        <Icon name={icon('chevron')} size={14} />
      </span>
    );
  };
  return (
    <>
      {row.past.start && mark('start')}
      {row.past.end && mark('end')}
    </>
  );
}
