import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { trackRun, type TrackShape } from '@weasel-js/geom';
import { AlongContext, type RunAlign } from '../Along/alongContext';
import { useItemLengths, useRunGap } from '../Along/useItemLengths';
import { RunBand, RunEnds, useRunRow } from '../Along/useRunRow';
import { positionAt } from '../Along/useRunScroll';
import { sideAtRun } from './barSide';
import { barItems, barLead, drawBarItem, inBarMenu, splitBarItems, type BarItem } from './barItems';
import type { BarLayoutProps } from './BarLayout';
import { BarOverflow } from './BarOverflow';
import { BAR_ITEM, BAR_LEAD, BAR_MORE, fitting } from './useBarOverflow';
import { useBarReorder } from './useBarReorder';
import { useBarReorderKeys } from './useBarReorderKeys';
import { useBarLead } from './barLeadHandle';
import b from './Bar.module.css';
import s from './BarAlong.module.css';

/** Props for {@link BarAlong}: a bar's, with the shape it lies along settled. */
export interface BarAlongProps extends BarLayoutProps {
  shape: TrackShape;
  align: RunAlign;
}

/** The key a child of a curved bar lies on its run under: its item key, else `BAR_MORE` or `BAR_LEAD`. */
const barKeyOf = (child: Element): string | null =>
  child.getAttribute(BAR_ITEM) ?? (child.hasAttribute(BAR_MORE) ? BAR_MORE : child.hasAttribute(BAR_LEAD) ? BAR_LEAD : null);

/**
 * A bar whose items lie along a curved track shape, each centered on its spot and tipped to it, in reading order
 * after any flip. Every leaf but an action opens from a button. In `'menu'` mode what does not fit along the
 * run opens from the More button at its reading end, and a run the More button and the lead alone overfill sits
 * centered; in `'scroll'` mode the run scrolls along itself.
 */
export function BarAlong(props: BarAlongProps): ReactElement {
  const { nodes, cells, row, attrs, rootAttrs, label, className, shape, align } = props;
  const { overflow = 'scroll', overflowLabel = 'More' } = props;
  const menu = overflow === 'menu';
  const root = useRef<HTMLDivElement>(null);
  const run = useMemo(() => trackRun(shape), [shape]);
  const items = barItems(nodes, { popLeaves: true, cells, row, mark: props.onReorder !== undefined });
  const leading = useBarLead(barLead(props.lead, label, props.icon));
  const lengths = useItemLengths(root, drawnKeys(items, leading != null), barKeyOf);
  const gap = useRunGap(root);

  const leadLength = leading != null ? (lengths.get(BAR_LEAD) ?? 0) : 0;
  const room = { size: run.length - (leadLength ? leadLength + gap : 0), gap };
  const kept = menu ? Math.min(items.length, fitting(items.map((item) => item.key), lengths, lengths.get(BAR_MORE) ?? 0, room)) : items.length;
  const { line, rest } = splitBarItems(items, kept);

  const order = [...(leading != null ? [BAR_LEAD] : []), ...line.map((item) => item.key), ...(rest.length > 0 ? [BAR_MORE] : [])];
  const along = useRunRow({ root, keyOf: barKeyOf, run, lengths: order.map((key) => lengths.get(key) ?? 0), gap, align, overflow: menu ? 'center' : 'scroll' });
  const place = (i: number) => {
    const spot = along.place(i);
    return { ...spot, className: s.item!, side: sideAtRun(run, spot.at) };
  };
  const first = leading != null ? 1 : 0;
  const reorder = useBarReorder({ root, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, measure: (el, p) => positionAt(along.band.current ?? el, run, p) });
  const keys = useBarReorderKeys({ root, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, vertical: false });
  const onPointerDownCapture = (e: ReactPointerEvent): void => {
    reorder.onPointerDownCapture(e);
    along.rootProps.onPointerDownCapture(e);
  };

  return (
    <div {...rootAttrs} {...along.rootProps} onPointerDownCapture={onPointerDownCapture} onKeyDownCapture={keys.onKeyDownCapture} ref={root} className={[s.root, className].filter(Boolean).join(' ')} data-shape={shape.kind} data-overflow={menu ? 'menu' : undefined} role={label === undefined ? undefined : 'toolbar'} aria-label={label}>
      <RunBand row={along} shape={shape} />
      {props.onReorder && <span role="status" className={b.status}>{keys.announcement}</span>}
      <AlongContext.Provider value={null}>
        {leading != null && <span className={`${b.lead} ${s.item}`} {...leading.attrs} style={place(0).style} data-clipped={place(0).clipped}>{leading.content}</span>}
        {line.map((item, i) => drawBarItem(item, false, attrs, place(first + i)))}
        {rest.length > 0 && (
          <span className={`${b.cell} ${s.item}`} {...{ [BAR_MORE]: '' }} style={place(order.length - 1).style}>
            <BarOverflow label={overflowLabel} side={place(order.length - 1).side}>{rest.map((item) => drawBarItem(inBarMenu(item), true, attrs))}</BarOverflow>
          </span>
        )}
      </AlongContext.Provider>
      <RunEnds row={along} run={run} />
    </div>
  );
}

/** The keys of what the bar holds, so its lengths are watched again when that set changes. */
function drawnKeys(items: readonly BarItem[], lead: boolean): string[] {
  return [...(lead ? [BAR_LEAD] : []), ...items.map((item) => item.key)];
}
