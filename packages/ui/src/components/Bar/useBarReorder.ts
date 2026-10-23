import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { keysHeld, modifierStateOf, startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import type { PrefOrder } from '@weasel-js/prefs';
import { useKitSetting, useLatest } from '@weasel-js/react';
import { swallowNextClick } from '../../useReorderDragList';
import { BAR_IN, BAR_UNIT, barUnitKey, movedOrder } from './barOrder';

/** Set on the elements of the unit a reorder is dragging. */
export const BAR_DRAGGING = 'data-bar-dragging';

/** Set on the sibling a dragged unit would land beside: `'before'` or `'after'` it along the line. */
export const BAR_DROP = 'data-bar-drop';

/** A point on screen, as a pointer event carries it. */
export interface BarPoint {
  clientX: number;
  clientY: number;
}

/** What {@link useBarReorder} reads. */
export interface BarReorderArgs {
  /** The bar's own element, under which its units are marked. */
  root: RefObject<HTMLElement | null>;
  order: PrefOrder | undefined;
  /** Unset, a press reorders nothing. */
  onReorder?: (order: PrefOrder) => void;
  /** How far along the bar's line `at` lies, `el` being the bar's root: x or y for a straight bar, the distance
   *  along the run for a curved one. */
  measure: (el: HTMLElement, at: BarPoint) => number;
  /** Every child key of the container at a path, in its drawn order, hidden and overflowed children included; undefined
   *  for a container it cannot list, whose drawn units are then the whole list. */
  keysOf?: (container: string) => readonly string[] | undefined;
}

/** The handler a bar's root takes so a Cmd-drag (Ctrl-drag off Apple platforms) reorders it. */
export interface BarReorder {
  onPointerDownCapture: (e: ReactPointerEvent) => void;
}

/** One thing a reorder can move inside a container: its key there, its outermost marked elements, and its middle. */
export interface Unit {
  key: string;
  els: HTMLElement[];
  at: number;
}

/**
 * A Cmd-drag (Ctrl-drag off Apple platforms) on a marked unit of a bar moves it among the units of its container,
 * and with Shift held moves the group it sits in among that group's siblings. Past the drag threshold the dragged
 * unit is marked {@link BAR_DRAGGING} and the sibling it would land beside {@link BAR_DROP}; the release calls
 * `onReorder` once with the container's whole list in its new order, and the click it raises is swallowed. Escape
 * cancels. A plain press, and a Cmd-press released short of the threshold, is left to the item as a click.
 */
export function useBarReorder({ root, order, onReorder, measure, keysOf }: BarReorderArgs): BarReorder {
  const dragPx = useKitSetting('gestures.dragPx');
  const latest = useLatest({ order, onReorder, measure, keysOf, dragPx });
  const drag = useRef<ThresholdDragHandle | null>(null);

  useEffect(() => () => drag.current?.cancel(), []);

  const onPointerDownCapture = (e: ReactPointerEvent): void => {
    const el = root.current;
    if (latest.current.onReorder === undefined || el === null || drag.current !== null || e.button !== 0 || !keysHeld(['mod'], modifierStateOf(e), isApplePlatform())) return;
    const grabbed = (e.target as Element).closest?.(`[${BAR_UNIT}]`);
    if (!grabbed || !el.contains(grabbed)) return;
    const { container, key } = grabbedUnit(grabbed, e.shiftKey);
    const along = (p: BarPoint): number => latest.current.measure(el, p);
    let units: Unit[] = [];
    let from = -1;
    let to = -1;
    const end = (): void => {
      drag.current = null;
      for (const mark of el.querySelectorAll(`[${BAR_DRAGGING}], [${BAR_DROP}]`)) {
        mark.removeAttribute(BAR_DRAGGING);
        mark.removeAttribute(BAR_DROP);
      }
    };
    drag.current = startThresholdDrag(e, {
      origin: el,
      captureAt: 'threshold',
      threshold: latest.current.dragPx,
      onActivate: () => {
        units = containerUnits(el, container, along);
        from = units.findIndex((unit) => unit.key === key);
        to = from;
        for (const mark of units[from]?.els ?? []) mark.setAttribute(BAR_DRAGGING, '');
      },
      onMove: (ev) => {
        if (from < 0) return;
        to = dropIndex(units, from, along(ev));
        markDrop(el, units, from, to);
      },
      onCommit: () => {
        end();
        swallowNextClick(el);
        const { order: was = {}, onReorder: done, keysOf: listOf } = latest.current;
        const target = dropTarget(units, from, to);
        if (target === undefined || !done) return;
        const next = movedInto(was, container, listOf?.(container), units, from, target);
        if (next !== was) done(next);
      },
      onClick: end,
      onCancel: end,
    });
  };

  return { onPointerDownCapture };
}

/** The container a press on `grabbed` reorders and the key it moves there: its own, or with `group` its group's. */
export function grabbedUnit(grabbed: Element, group: boolean): { container: string; key: string } {
  const at = grabbed.getAttribute(BAR_IN) ?? '';
  if (group && at !== '') return { container: at.includes('.') ? at.slice(0, at.lastIndexOf('.')) : '', key: barUnitKey(at) };
  return { container: at, key: grabbed.getAttribute(BAR_UNIT)! };
}

/** The key inside `container` of a unit marked in `at` with key `own`: its own key, the key of the group or run of
 *  `container`'s it sits in, or null outside `container`. */
function keyIn(container: string, at: string, own: string): string | null {
  if (at === container) return own;
  const prefix = container === '' ? '' : `${container}.`;
  if (at === '' || !at.startsWith(prefix)) return null;
  const rest = at.slice(prefix.length);
  const dot = rest.indexOf('.');
  return dot < 0 ? rest : rest.slice(0, dot);
}

/** `container`'s units as drawn under `root`, in document order: each key's outermost elements and its middle. */
export function containerUnits(root: HTMLElement, container: string, along: (p: BarPoint) => number): Unit[] {
  const found = new Map<string, HTMLElement[]>();
  for (const el of root.querySelectorAll<HTMLElement>(`[${BAR_UNIT}]`)) {
    const key = keyIn(container, el.getAttribute(BAR_IN) ?? '', el.getAttribute(BAR_UNIT)!);
    if (key === null) continue;
    const els = found.get(key) ?? [];
    // Document order puts an ancestor first, so an element inside one already kept is a part of it.
    if (!els.some((kept) => kept.contains(el))) els.push(el);
    found.set(key, els);
  }
  return Array.from(found, ([key, els]) => {
    const ats = els.map((el) => {
      const box = el.getBoundingClientRect();
      return along({ clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
    });
    return { key, els, at: (Math.min(...ats) + Math.max(...ats)) / 2 };
  });
}

/** Where the unit at `from` lands with the pointer `p` along the line: how many of the others it passes. A line whose
 *  units run backward along the measure, as a right-to-left one does along x, counts the other way. A `from` of -1 is a
 *  unit arriving from elsewhere, so every unit counts. */
export function dropIndex(units: readonly { at: number }[], from: number, p: number): number {
  const backward = units.length > 1 && units.at(-1)!.at < units[0]!.at;
  return units.filter((unit, i) => i !== from && (backward ? unit.at > p : unit.at < p)).length;
}

/** The sibling the unit at `from` lands beside at `to`, and on which side; undefined where it lands where it is. */
function dropTarget(units: readonly Unit[], from: number, to: number): { unit: Unit; after: boolean } | undefined {
  if (from < 0 || to === from) return undefined;
  const others = units.filter((_, i) => i !== from);
  const after = to > from;
  const unit = after ? others[to - 1] : others[to];
  return unit && { unit, after };
}

/** Marks the sibling the unit at `from` lands beside at `to`, or none where it lands where it is. */
function markDrop(root: HTMLElement, units: readonly Unit[], from: number, to: number): void {
  for (const mark of root.querySelectorAll(`[${BAR_DROP}]`)) mark.removeAttribute(BAR_DROP);
  const target = dropTarget(units, from, to);
  if (target === undefined) return;
  const el = target.after ? target.unit.els.at(-1) : target.unit.els[0];
  el?.setAttribute(BAR_DROP, target.after ? 'after' : 'before');
}

/**
 * `order` with the unit at `from` moved beside `target` in `container`'s list. With `full`, the container's whole
 * list, the move is made in it, so children nothing draws keep their places; else in the drawn `units`.
 */
export function movedInto(order: PrefOrder, container: string, full: readonly string[] | undefined, units: readonly Unit[], from: number, target: { unit: Unit; after: boolean }): PrefOrder {
  const keys = full ?? units.map((unit) => unit.key);
  const moved = units[from]!.key;
  const at = keys.filter((key) => key !== moved).indexOf(target.unit.key);
  if (at < 0) return order;
  return movedOrder(order, container, keys, keys.indexOf(moved), at + (target.after ? 1 : 0));
}
