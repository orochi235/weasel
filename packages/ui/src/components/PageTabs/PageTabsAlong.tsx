import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { trackRun, type RunAlign, type TrackShape } from '@weasel-js/geom';
import type { ReorderLine } from '../../useReorderDragList';
import { AlongContext } from '../Along/alongContext';
import { createRunSlots, RUN_HOST, slotClass, useRunSlot, useRunSlotHost, type RunSlotHost } from '../Along/runSlots';
import { useRunGap } from '../Along/useItemLengths';
import { RunBand, RunEnds } from '../Along/useRunRow';
import { positionAt } from '../Along/useRunScroll';
import { TabList, Tabs } from '../Tabs';
import { TabSlotsContext } from '../Tabs/Tabs';
import { TabRule } from '../Tabs/TabRule';
import type { PageTabItem, PageTabsProps } from './PageTabs';
import { NONE, usePageTabs } from './usePageTabs';
import t from '../Tabs/Tabs.module.css';
import s from './PageTabs.module.css';

/** The + button's key on the run: one no page id can be. */
const ADD = '\u0000add';

/** Props for {@link PageTabsAlong}: a page strip's, with the shape it lies along settled. */
export type PageTabsAlongProps<P extends PageTabItem> = PageTabsProps<P> & { shape: TrackShape; align: RunAlign };

/**
 * A page strip whose tabs lie along a curved track shape, the + button last on the run. A drag measures the tabs and
 * the pointer along the run and marks where the tab would land across it; a run too long for its shape scrolls from a
 * press between the tabs, the wheel, or focus.
 */
export function PageTabsAlong<P extends PageTabItem>(props: PageTabsAlongProps<P>): ReactElement {
  const { shape, align, pages, current } = props;
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<SVGSVGElement>(null);
  const run = useMemo(() => trackRun(shape), [shape]);
  const slots = useMemo(() => createRunSlots(true), []);
  const gap = useRunGap(root);
  const host = useRunSlotHost({ slots, root, run, gap, align });
  const line = useMemo<ReorderLine>(() => ({
    row: (el) => {
      const length = el.offsetWidth;
      return { start: Number(el.getAttribute('data-run-at')) - length / 2, length };
    },
    pointer: (client) => positionAt(frame.current ?? root.current!, run, client),
  }), [run]);
  const parts = usePageTabs(props, line);
  const drop = dropAt(parts.drag.state.targetIndex, pages, host, run.length, gap);

  const onPointerDownCapture = (e: ReactPointerEvent): void => {
    parts.onPointerDownCapture();
    // A tab that moves takes a drag along the run as its own; the run scrolls from a press between the tabs.
    if (props.onMove && (e.target as Element).closest('[role="tab"]')) return;
    host.rootProps.onPointerDownCapture(e);
  };

  return (
    <div
      ref={root}
      {...{ [RUN_HOST]: '' }}
      {...host.rootProps}
      onPointerDownCapture={onPointerDownCapture}
      onKeyDownCapture={parts.onKeyDownCapture}
      className={[t.along, s.along, props.className].filter(Boolean).join(' ')}
      data-shape={shape.kind}
    >
      <RunBand row={host} shape={shape} />
      <TabRule run={run} host={host} selected={current} drop={drop} ref={frame} />
      <TabSlotsContext.Provider value={slots}>
        <AlongContext.Provider value={null}>
          <Tabs className={s.tabs} selectedKey={current ?? NONE} onSelectionChange={parts.onSelectionChange}>
            <TabList aria-label={props['aria-label'] ?? 'Pages'} ref={parts.bindList}>
              {parts.tabs}
            </TabList>
          </Tabs>
          {props.onAdd && <AddOnRun onAdd={props.onAdd} />}
        </AlongContext.Provider>
      </TabSlotsContext.Provider>
      <RunEnds row={host} run={run} />
      {parts.ghost}
    </div>
  );
}

/** The + button, in its place on the run. */
function AddOnRun({ onAdd }: { onAdd: () => void }): ReactElement {
  const slot = useRunSlot(TabSlotsContext, ADD);
  return (
    <button type="button" {...slot} className={slotClass(slot, s.add)} aria-label="Add page" title="Add page" onClick={onAdd}>+</button>
  );
}

/** Px along the run where a tab dropped at `target`, an index into `pages`, would land: midway across the gap there. */
function dropAt(target: number | null, pages: readonly PageTabItem[], host: RunSlotHost, length: number, gap: number): number | null {
  if (target === null || pages.length === 0) return null;
  const before = target < pages.length;
  const page = pages[before ? target : pages.length - 1]!;
  const place = host.placeOf(page.id);
  if (place === undefined) return null;
  const reach = host.lengthOf(page.id) / 2 + gap / 2;
  return place.at * length + (before ? -reach : reach);
}
