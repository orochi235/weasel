import { useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { TrackShape } from '@weasel-js/geom';
import { screenDirection } from '../Along/rowRun';
import { useRowRun } from '../Along/useRowRun';
import type { RunAlign } from '../Along/alongContext';
import { RunScope } from '../Run';
import { useItemLengths, useRunGap } from '../Along/useItemLengths';
import { RUN_SLACK, RunBand, RunEnds, useRunRow } from '../Along/useRunRow';
import { positionAt } from '../Along/useRunScroll';
import { sideAtRun } from './barSide';
import { barLead, drawBarItem, inBarMenu, splitBarItems, type LineItem } from './barItems';
import { barRoot, type BarLineProps } from './BarLine';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { BarOverflow } from './BarOverflow';
import { BAR_ITEM, BAR_LEAD, BAR_MORE, fitting } from './useBarOverflow';
import { useBarReorder } from './useBarReorder';
import { useBarReorderKeys } from './useBarReorderKeys';
import { useBarLead } from './barLeadHandle';
import { DockBarContext } from '../ToolbarDock/dockContext';
import b from './Bar.module.css';
import f from './barFrames.module.css';
import s from './BarAlong.module.css';

/** Props for {@link BarAlong}: a bar's, with the shape it lies along settled. */
export interface BarAlongProps extends BarLineProps {
  shape: TrackShape;
  align: RunAlign;
}

/** The key a child of a curved bar lies on its run under: its item key, else `BAR_MORE` or `BAR_LEAD`. */
const barKeyOf = (child: Element): string | null =>
  child.getAttribute(BAR_ITEM) ?? (child.hasAttribute(BAR_MORE) ? BAR_MORE : child.hasAttribute(BAR_LEAD) ? BAR_LEAD : null);

/**
 * A bar whose items lie along a curved track shape, each centered on its spot and tipped to it, from the shape's own
 * start (its end under `rtl`) and standing upright. Every leaf but an action opens from a button. In `'menu'` mode what does not fit along the
 * run opens from the More button at its far end, and a run the More button and the lead alone overfill sits
 * centered; in `'scroll'` mode the run scrolls along itself.
 */
export function BarAlong(props: BarAlongProps): ReactElement {
  const { items, rootAttrs, label, className, shape, align } = props;
  const { overflow = 'scroll', overflowLabel = 'More' } = props;
  const menu = overflow === 'menu';
  const rootRef = useRef<HTMLDivElement>(null);
  const run = useRowRun(rootRef, shape);
  const leading = useBarLead(barLead(props));
  const lengths = useItemLengths(rootRef, drawnKeys(items, leading != null), barKeyOf);
  const gap = useRunGap(rootRef);

  const leadLength = leading != null ? (lengths.get(BAR_LEAD) ?? 0) : 0;
  const room = { size: run.length + RUN_SLACK - (leadLength ? leadLength + gap : 0), gap };
  const kept = menu ? Math.min(items.length, fitting(items.map((item) => item.key), lengths, lengths.get(BAR_MORE) ?? 0, room)) : items.length;
  const { line, rest } = splitBarItems(items, kept);

  const order = [...(leading != null ? [BAR_LEAD] : []), ...line.map((item) => item.key), ...(rest.length > 0 ? [BAR_MORE] : [])];
  const along = useRunRow({ root: rootRef, keyOf: barKeyOf, run, lengths: order.map((key) => lengths.get(key) ?? 0), gap, align, overflow: menu ? 'center' : 'scroll', modReorders: props.onReorder !== undefined });
  const place = (i: number) => {
    const spot = along.place(i);
    return { ...spot, className: s.item!, side: sideAtRun(run, spot.at) };
  };
  const first = leading != null ? 1 : 0;
  const reorder = useBarReorder({ root: rootRef, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, measure: (el, p) => positionAt(along.band.current ?? el, run, p) });
  const keys = useBarReorderKeys({ root: rootRef, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, vertical: false, dir: screenDirection(run) });
  const rove = useRovingTabIndex<HTMLDivElement>({ orientation: 'horizontal' });
  const roveRef = rove.rootRef;
  const { role } = barRoot(props);
  const onPointerDownCapture = (e: ReactPointerEvent): void => {
    reorder.onPointerDownCapture(e);
    // A press on a dock's handle moves the bar, so it does not also scroll the run.
    if (leading?.handle && (e.target as Element).closest?.(`[${BAR_LEAD}]`)) return;
    along.rootProps.onPointerDownCapture(e);
  };

  return (
    <div
      {...rootAttrs}
      {...along.rootProps}
      onPointerDownCapture={onPointerDownCapture}
      onKeyDownCapture={keys.onKeyDownCapture}
      onKeyDown={props.roving ? (e) => rove.onKeyDown(e, screenDirection(run)) : undefined}
      ref={(el) => {
        rootRef.current = el;
        roveRef.current = props.roving ? el : null;
      }}
      className={[s.root, props.sm && f.sm, className].filter(Boolean).join(' ')}
      data-shape={shape.kind}
      data-overflow={menu ? 'menu' : undefined}
      role={role}
      aria-label={label}
    >
      <RunBand row={along} shape={shape} />
      {props.onReorder && <span aria-live="polite" aria-atomic="true" data-bar-announce="" className={b.status}>{keys.announcement}</span>}
      <DockBarContext.Provider value={null}>
        <RunScope fresh>
          {leading != null && <span className={`${b.lead} ${s.item}`} {...leading.attrs} style={place(0).style} data-clipped={place(0).clipped}>{leading.content}</span>}
          {line.map((item, i) => drawBarItem(item, false, place(first + i)))}
          {rest.length > 0 && (
            <span className={`${b.cell} ${s.item}`} {...{ [BAR_MORE]: '' }} style={place(order.length - 1).style}>
              <BarOverflow label={overflowLabel} side={place(order.length - 1).side}>{rest.map((item) => drawBarItem(inBarMenu(item), true))}</BarOverflow>
            </span>
          )}
        </RunScope>
      </DockBarContext.Provider>
      <RunEnds row={along} run={run} />
    </div>
  );
}

/** The keys of what the bar holds, so its lengths are watched again when that set changes. */
function drawnKeys(items: readonly LineItem[], lead: boolean): string[] {
  return [...(lead ? [BAR_LEAD] : []), ...items.map((item) => item.key)];
}
