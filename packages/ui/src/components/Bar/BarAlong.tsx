import { useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import { placeAlongRun, runLength, runStationAt, trackRun, trackShapeD, type RunPlace, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { AlongContext, type RunAlign } from '../Along/alongContext';
import { placeStyle } from '../Along/placeOnRun';
import { sideAtRun } from './barSide';
import { barItems, barLead, drawBarItem, splitBarItems, type BarItem } from './barItems';
import type { BarLayoutProps } from './BarLayout';
import { BarOverflow } from './BarOverflow';
import { BAR_LEAD, BAR_MORE, fitting } from './useBarOverflow';
import { useItemLengths, useRunGap } from './useItemLengths';
import { useRunScroll } from './useRunScroll';
import b from './Bar.module.css';
import s from './BarAlong.module.css';

/** Props for {@link BarAlong}: a bar's, with the shape it lies along settled. */
export interface BarAlongProps extends BarLayoutProps {
  shape: TrackShape;
  align: RunAlign;
}

/**
 * A bar whose items lie along a curved track shape, each centered on its spot and tipped to it, in reading order
 * after any flip. Every leaf but an action opens from a button. In `'menu'` mode what does not fit along the
 * run opens from the More button at its reading end; in `'scroll'` mode the run scrolls along itself.
 */
export function BarAlong(props: BarAlongProps): ReactElement {
  const { nodes, cells, row, attrs, rootAttrs, label, className, shape, align } = props;
  const { overflow = 'scroll', overflowLabel = 'More' } = props;
  const menu = overflow === 'menu';
  const root = useRef<HTMLDivElement>(null);
  const run = useMemo(() => trackRun(shape), [shape]);
  const items = barItems(nodes, { popLeaves: true, cells, row });
  const leading = barLead(props.lead, label, props.icon);
  const lengths = useItemLengths(root, drawnKeys(items, leading != null));
  const gap = useRunGap(root);

  const leadLength = leading != null ? (lengths.get(BAR_LEAD) ?? 0) : 0;
  const room = { size: run.length - (leadLength ? leadLength + gap : 0), gap };
  const kept = menu ? Math.min(items.length, fitting(items.map((item) => item.key), lengths, lengths.get(BAR_MORE) ?? 0, room)) : items.length;
  const { line, rest } = splitBarItems(items, kept);

  const order = [...(leading != null ? [BAR_LEAD] : []), ...line.map((item) => item.key), ...(rest.length > 0 ? [BAR_MORE] : [])];
  const orderLengths = order.map((key) => lengths.get(key) ?? 0);
  const total = menu ? 0 : runLength(orderLengths, gap);
  let spots: RunPlace[] = [];
  const scroll = useRunScroll({ root, run, total, spots: () => spots, lengths: orderLengths });
  spots = alongSpots(run, orderLengths, gap, align, menu, scroll.offset);
  const place = (i: number) => {
    const spot = spots[i]!;
    // A zero-length run has no direction to carry items along: they all sit at its one point.
    const flat = run.length <= 0;
    const style: CSSProperties = placeStyle(flat ? run.at(0.5) : spot);
    if (!menu && !flat) Object.assign(style, { '--along-shown': shownOf(spot.center, orderLengths[i] ?? 0, run.length) });
    return { className: s.item!, style, clipped: menu ? undefined : spot.clipped, side: sideAtRun(run, flat ? 0.5 : spot.center / run.length) };
  };
  const first = leading != null ? 1 : 0;
  const scrolls = total > run.length;

  return (
    <div {...rootAttrs} ref={root} className={[s.root, className].filter(Boolean).join(' ')} data-shape={shape.kind} data-overflow={menu ? 'menu' : undefined} data-scrolls={scrolls ? '' : undefined} role={label === undefined ? undefined : 'toolbar'} aria-label={label} onPointerDownCapture={scroll.onPointerDownCapture} onFocusCapture={scroll.onFocusCapture}>
      {scrolls && (
        <svg className={s.band} aria-hidden="true">
          <path className={s.bandPath} d={trackShapeD(shape)} />
        </svg>
      )}
      <AlongContext.Provider value={null}>
        {leading != null && <span className={`${b.lead} ${s.item}`} aria-hidden="true" {...{ [BAR_LEAD]: '' }} style={place(0).style} data-clipped={place(0).clipped}>{leading}</span>}
        {line.map((item, i) => drawBarItem(item, false, attrs, place(first + i)))}
        {rest.length > 0 && (
          <span className={`${b.cell} ${s.item}`} {...{ [BAR_MORE]: '' }} style={place(order.length - 1).style}>
            <BarOverflow label={overflowLabel} side={place(order.length - 1).side}>{rest.map((item) => drawBarItem(item, true, attrs))}</BarOverflow>
          </span>
        )}
      </AlongContext.Provider>
      {scrolls && <MorePast run={run} start={scroll.offset > 0} end={total - scroll.offset > run.length} />}
    </div>
  );
}

/** The keys of what the bar holds, so its lengths are watched again when that set changes. */
function drawnKeys(items: readonly BarItem[], lead: boolean): string[] {
  return [...(lead ? [BAR_LEAD] : []), ...items.map((item) => item.key)];
}

/** Where a curved bar's items fall on its run: laid back by `offset`, except that a `'menu'` run too long for its room, which only the More button and the lead can make, sits centered. An item part past an end carries on along the shape, so a scroll slides it off as it fades; once wholly past, and unseen, it waits at that end. */
function alongSpots(run: TrackRun, lengths: readonly number[], gap: number, align: RunAlign, menu: boolean, offset: number): RunPlace[] {
  const over = menu ? Math.max(0, (runLength(lengths, gap) - run.length) / 2) : offset;
  return placeAlongRun(run, lengths, { gap, align, offset: over, past: 'hold' });
}

/** The share of an item `length` long centered at `center` that lies on a run `room` long: its opacity as it slides off. */
export function shownOf(center: number, length: number, room: number): number {
  if (length <= 0) return center >= 0 && center <= room ? 1 : 0;
  const lo = center - length / 2;
  const on = Math.min(room, lo + length) - Math.max(0, lo);
  return Math.max(0, Math.min(1, on / length));
}

/** Px a chevron sits out past its run's end, clear of the item fading there. */
const MORE_PAST_OUT = 10;

/** A chevron at each end of a scrolled run that has items past it, pointing out along the run. */
function MorePast({ run, start, end }: { run: TrackRun; start: boolean; end: boolean }): ReactElement {
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
      {start && mark('start')}
      {end && mark('end')}
    </>
  );
}
