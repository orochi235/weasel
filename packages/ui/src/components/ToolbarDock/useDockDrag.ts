import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { useKitSetting, useLatest } from '@weasel-js/react';
import { swallowNextClick } from '../../useReorderDragList';
import { BAR_LEAD } from '../Bar/useBarOverflow';
import { DOCK_BAR, drawnBars, drawnLayout, keyTarget, movedLayout, placeWords, spreadTarget, type DockDropMark } from './dockDrop';
import { floatWhereDrawn, grabBar, homeTarget, measureEmpties, tearStep, type DockGrab } from './dockTear';
import { canEnter, type DockBar, type DockSpec, type FloatPlace, type ToolbarLayout } from './layout';
import { isNudgeChord } from '../../nudgeKey';

/**
 * What a drag in progress shows: the bar it lifted, the drawn docks that bar may not enter, where it would drop, and
 * where it floats under the pointer once it has left its dock, or all along for a bar that floated already.
 */
export interface DockDragView {
  barId: string;
  unavailable: ReadonlySet<string>;
  drop: DockDropMark | null;
  float: FloatPlace | null;
  /** The bar's size at the press: the room its dock slot keeps while it floats. */
  size: { w: number; h: number };
}

/** What {@link useDockDrag} reads. */
export interface DockDragArgs {
  /** The dock's own element, under which its docks, rows and bars are marked. */
  root: RefObject<HTMLElement | null>;
  /** The layer floating bars sit in. */
  layer: RefObject<HTMLElement | null>;
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
  /** The layout to draw: the last move made, until `layout` changes or the next move begins; else `layout`. */
  layout: ToolbarLayout;
  /** Where the last keyboard move landed; empty until one has. */
  announcement: string;
  /** One bar's handlers: the same function across renders, giving the same object for a bar each time. */
  handlers: (barId: string) => DockHandleHandlers;
}

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const same = (a: DockDropMark | FloatPlace | null, b: DockDropMark | FloatPlace | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Moving bars by their handles. Dragged past the threshold, a handle lifts its bar: docks it may not enter are listed
 * in `view.unavailable`, and `view.drop` says where it would land. A bar that may float tears off its dock past
 * `TEAR_PX` and floats under the pointer in `view.float`; over a dock it may enter it drops into that dock again. The
 * release calls `onLayoutChange` once, and the click it raises is swallowed; Escape cancels, and a drop where the bar
 * already is calls nothing. The move is drawn until `layout` is a new object, which is how a host accepts it; a host
 * that ignores a move keeps seeing it until its next layout. Alt+arrows on a focused handle move the bar by a slot, a row, or a dock, and Alt+Enter
 * floats it where it is or docks it again; either keeps focus on the handle and sets `announcement`. A bar drawn as
 * nothing is stepped over and keeps its place.
 */
export function useDockDrag({ root, layer, docks, bars, layout: given, onLayoutChange }: DockDragArgs): DockDrag {
  const dragPx = useKitSetting('gestures.dragPx');
  const [held, setHeld] = useState<{ next: ToolbarLayout; over: ToolbarLayout } | null>(null);
  const layout = held?.over === given ? held.next : given;
  const latest = useLatest({ docks, bars, layout, given, onLayoutChange, dragPx });
  const drag = useRef<ThresholdDragHandle | null>(null);
  const refocus = useRef<string | null>(null);
  const [view, setView] = useState<DockDragView | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => () => drag.current?.cancel(), []);

  // A moved bar may be drawn afresh in its new row, or in the floating layer, so its handle is found again by the bar's mark.
  useLayoutEffect(() => {
    const id = refocus.current;
    refocus.current = null;
    if (id === null || !root.current) return;
    const wrap = Array.from(root.current.querySelectorAll(`[${DOCK_BAR}]`)).find((el) => el.getAttribute(DOCK_BAR) === id);
    const handle = wrap?.querySelector<HTMLElement>(`[${BAR_LEAD}]`);
    if (handle && handle !== document.activeElement) handle.focus();
  });

  const barOf = (id: string) => latest.current.bars.find((b) => b.id === id);

  // Drawn as moved until the host's layout arrives, which it may send a tick later.
  const commit = (next: ToolbarLayout): void => {
    setHeld({ next, over: latest.current.given });
    latest.current.onLayoutChange?.(next);
  };

  const onPointerDown = (barId: string, e: ReactPointerEvent<HTMLElement>): void => {
    const el = root.current;
    const into = layer.current;
    const bar = barOf(barId);
    if (!el || !into || !bar || !latest.current.onLayoutChange || drag.current !== null || e.button !== 0) return;
    const press = { clientX: e.clientX, clientY: e.clientY };
    const torn = { now: false };
    let grab: DockGrab | null = null;
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
        grab = grabBar(el, into, latest.current.docks, bar, latest.current.layout);
        setHeld(null);
        const unavailable = new Set(grab.boxes.filter((d) => !canEnter(bar, d)).map((d) => d.id));
        setView({ barId, unavailable, drop: null, float: grab.row ? null : grab.from, size: grab.size });
      },
      onMove: (ev) => {
        if (!grab) return;
        if (grab.empties === null) {
          const drawn = measureEmpties(el);
          if (drawn.length) grab.empties = drawn;
        }
        const step = tearStep(grab, bar, press, ev, torn);
        const was = latest.current.layout;
        if (step.drop) next = movedLayout(was, barId, spreadTarget(was, barId, step.drop.target, grab.drawn));
        else next = step.float && movedLayout(was, barId, { float: step.float });
        const mark = next && step.drop ? step.drop.mark : null;
        const float = step.float;
        setView((v) => (v === null || (same(v.drop, mark) && same(v.float, float)) ? v : { ...v, drop: mark, float }));
      },
      onCommit: () => {
        end();
        swallowNextClick(el);
        if (next) commit(next);
      },
      onClick: end,
      onCancel: end,
    });
  };

  /** Alt+Enter: a docked bar floats where it is drawn, and a floating one docks at the end of its home dock. */
  const toggleFloat = (was: ToolbarLayout, bar: DockBar, drawn: ReadonlySet<string>): { next: ToolbarLayout; words: string } | null => {
    const specs = latest.current.docks;
    if (was.floating[bar.id]) {
      const to = homeTarget(was, specs, bar);
      const next = to && movedLayout(was, bar.id, spreadTarget(was, bar.id, to, drawn));
      return next && { next, words: placeWords(drawnLayout(next, drawn, bar.id), specs, bar, 'docked') };
    }
    const place = root.current && layer.current && floatWhereDrawn(root.current, layer.current, was, specs, bar.id);
    const next = place && movedLayout(was, bar.id, { float: place });
    return next && { next, words: `${bar.label} toolbar floating` };
  };

  const onKeyDown = (barId: string, e: ReactKeyboardEvent<HTMLElement>): void => {
    const { layout: was, docks: specs, onLayoutChange: done } = latest.current;
    const bar = barOf(barId);
    const floats = bar?.float === true && e.key === 'Enter';
    if (!bar || !done || !isNudgeChord(e) || !(floats || ARROWS.has(e.key))) return;
    e.preventDefault();
    e.stopPropagation();
    const drawn = root.current ? drawnBars(root.current) : new Set(latest.current.bars.map((b) => b.id));
    let moved: { next: ToolbarLayout; words: string } | null;
    if (floats) moved = toggleFloat(was, bar, drawn);
    else {
      const to = keyTarget(drawnLayout(was, drawn, barId), specs, bar, e.key);
      const next = to && movedLayout(was, barId, spreadTarget(was, barId, to, drawn));
      moved = next && { next, words: placeWords(drawnLayout(next, drawn, barId), specs, bar) };
    }
    if (!moved) return;
    refocus.current = barId;
    setAnnouncement(moved.words);
    commit(moved.next);
  };

  const handlers = useStableHandlers(onPointerDown, onKeyDown);
  return { view, layout, announcement, handlers };
}

/**
 * One handler object per bar, the same across renders, calling the latest `down` and `key`. Stable, so the dock's
 * context for each bar does not change, and redraw every bar, on each frame of a drag.
 */
function useStableHandlers(
  down: (barId: string, e: ReactPointerEvent<HTMLElement>) => void,
  key: (barId: string, e: ReactKeyboardEvent<HTMLElement>) => void,
): DockDrag['handlers'] {
  const on = useLatest({ down, key });
  const made = useRef(new Map<string, DockHandleHandlers>());
  return useCallback((barId: string): DockHandleHandlers => {
    let got = made.current.get(barId);
    if (!got) {
      got = { onPointerDown: (e) => on.current.down(barId, e), onKeyDown: (e) => on.current.key(barId, e) };
      made.current.set(barId, got);
    }
    return got;
  }, [on]);
}
