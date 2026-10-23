import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { useKitSetting, useLatest } from '@weasel-js/react';
import { swallowNextClick } from '../../useReorderDragList';
import { BAR_LEAD } from '../Bar/useBarOverflow';
import { DOCK_BAR, dropAt, keyTarget, measureDocks, movedLayout, placeWords, type DockBox, type DockDropMark } from './dockDrop';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';

/** What a drag in progress shows: the bar it lifted, the drawn docks that bar may not enter, and where it would drop. */
export interface DockDragView {
  barId: string;
  unavailable: ReadonlySet<string>;
  drop: DockDropMark | null;
}

/** What {@link useDockDrag} reads. */
export interface DockDragArgs {
  /** The dock's own element, under which its docks, rows and bars are marked. */
  root: RefObject<HTMLElement | null>;
  docks: readonly DockSpec[];
  bars: readonly DockBar[];
  /** The layout as drawn, already resolved. */
  layout: ToolbarLayout;
  /** Unset, the handles move nothing. */
  onLayoutChange?: (layout: ToolbarLayout) => void;
}

/** The handlers one bar's handle takes. */
export interface DockHandleHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
}

/** What {@link useDockDrag} gives the dock. */
export interface DockDrag {
  view: DockDragView | null;
  /** Where the last keyboard move landed; empty until one has. */
  announcement: string;
  handlers: (barId: string) => DockHandleHandlers;
}

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const sameMark = (a: DockDropMark | null, b: DockDropMark | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Moving bars by their handles. Dragged past the threshold, a handle lifts its bar: docks it may not enter are listed
 * in `view.unavailable`, and `view.drop` says where it would land. The release calls `onLayoutChange` once, and the
 * click it raises is swallowed; Escape cancels, and a drop where the bar already is calls nothing. Alt+arrows on a
 * focused handle move the bar by a slot, a row, or a dock, keep focus on the handle, and set `announcement`.
 */
export function useDockDrag({ root, docks, bars, layout, onLayoutChange }: DockDragArgs): DockDrag {
  const dragPx = useKitSetting('gestures.dragPx');
  const latest = useLatest({ docks, bars, layout, onLayoutChange, dragPx });
  const drag = useRef<ThresholdDragHandle | null>(null);
  const refocus = useRef<string | null>(null);
  const [view, setView] = useState<DockDragView | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => () => drag.current?.cancel(), []);

  // A moved bar may be drawn afresh in its new row, so its handle is found again by the bar's mark.
  useLayoutEffect(() => {
    const id = refocus.current;
    refocus.current = null;
    if (id === null || !root.current) return;
    const wrap = Array.from(root.current.querySelectorAll(`[${DOCK_BAR}]`)).find((el) => el.getAttribute(DOCK_BAR) === id);
    const handle = wrap?.querySelector<HTMLElement>(`[${BAR_LEAD}]`);
    if (handle && handle !== document.activeElement) handle.focus();
  });

  const barOf = (id: string) => latest.current.bars.find((b) => b.id === id);

  const onPointerDown = (barId: string, e: ReactPointerEvent<HTMLElement>): void => {
    const el = root.current;
    const bar = barOf(barId);
    if (!el || !bar || !latest.current.onLayoutChange || drag.current !== null || e.button !== 0) return;
    let boxes: DockBox[] = [];
    let next: ToolbarLayout | null = null;
    const end = (): void => {
      drag.current = null;
      setView(null);
    };
    drag.current = startThresholdDrag(e, {
      origin: el,
      captureAt: 'threshold',
      threshold: latest.current.dragPx,
      onActivate: () => {
        boxes = measureDocks(el, latest.current.docks);
        const unavailable = new Set(boxes.filter((d) => !bar.docks.includes(d.id)).map((d) => d.id));
        setView({ barId, unavailable, drop: null });
      },
      onMove: (ev) => {
        const drop = dropAt(boxes, bar, ev);
        next = drop && movedLayout(latest.current.layout, barId, drop.target);
        const mark = next ? drop!.mark : null;
        setView((v) => (v === null || sameMark(v.drop, mark) ? v : { ...v, drop: mark }));
      },
      onCommit: () => {
        end();
        swallowNextClick(el);
        if (next) latest.current.onLayoutChange?.(next);
      },
      onClick: end,
      onCancel: end,
    });
  };

  const onKeyDown = (barId: string, e: ReactKeyboardEvent<HTMLElement>): void => {
    const { layout: was, docks: specs, onLayoutChange: done } = latest.current;
    const bar = barOf(barId);
    if (!bar || !done || !e.altKey || e.ctrlKey || e.metaKey || !ARROWS.has(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const to = keyTarget(was, specs, bar, e.key);
    const next = to && movedLayout(was, barId, to);
    if (!next) return;
    refocus.current = barId;
    setAnnouncement(placeWords(next, bar));
    done(next);
  };

  return {
    view,
    announcement,
    handlers: (barId) => ({ onPointerDown: (e) => onPointerDown(barId, e), onKeyDown: (e) => onKeyDown(barId, e) }),
  };
}
