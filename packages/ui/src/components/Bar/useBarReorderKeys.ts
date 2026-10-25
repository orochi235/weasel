import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import type { PrefOrder } from '@weasel-js/prefs';
import { useLatest } from '@weasel-js/react';
import { BAR_IN, BAR_UNIT } from './barOrder';
import { BAR_LEAD } from './useBarOverflow';
import { containerUnits, grabbedUnit, movedInto } from './useBarReorder';
import { inlineDirection } from '../../useRovingTabIndex';
import { nudgeOf } from '../../nudgeKey';

/** What {@link useBarReorderKeys} reads. */
export interface BarReorderKeysArgs {
  /** The bar's own element, under which its units are marked. */
  root: RefObject<HTMLElement | null>;
  order: PrefOrder | undefined;
  /** Unset, the keys do nothing and no shortcuts are named. */
  onReorder?: (order: PrefOrder) => void;
  /** A vertical bar answers to Alt+Up and Down; any other, to Alt+Left and Right, mirrored under right-to-left. */
  vertical: boolean;
  /** As on `useBarReorder`: every child key of a container, so children nothing draws keep their places. */
  keysOf?: (container: string) => readonly string[] | undefined;
}

/** What a bar's root takes so Alt+arrows reorder it, and the words to announce each move in. */
export interface BarReorderKeys {
  onKeyDownCapture: (e: ReactKeyboardEvent) => void;
  /** Where the last move landed, as "`name`, `n` of `m`"; empty until one has. */
  announcement: string;
}

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]';

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file', 'image']);

/** True where Alt+arrow means word motion: a text-entry input, or a textarea. */
function entersText(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type);
}

/** The control a unit's keys act on: the unit itself where it takes focus, else the first control inside it. */
function focusableOf(unit: HTMLElement): HTMLElement {
  return unit.matches(FOCUSABLE) ? unit : (unit.querySelector<HTMLElement>(FOCUSABLE) ?? unit);
}

/** What a unit is called: its control's `aria-label`, else its text. */
function nameOf(unit: HTMLElement): string {
  const control = focusableOf(unit);
  return control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '';
}

/**
 * Alt+Left/Right (Alt+Up/Down on a vertical bar) moves the marked unit holding focus one place along its
 * container's list, and with Shift moves the group it sits in. An end of the line does nothing, and so does a
 * text-entry field, which keeps Alt+arrow for word motion. Each move calls `onReorder` once, keeps focus on the
 * control that had it, and sets `announcement`.
 */
export function useBarReorderKeys({ root, order, onReorder, vertical, keysOf }: BarReorderKeysArgs): BarReorderKeys {
  const latest = useLatest({ order, onReorder, keysOf });
  const [announcement, setAnnouncement] = useState('');
  const refocus = useRef<{ container: string; key: string } | null>(null);
  const enabled = onReorder !== undefined;

  // The moved control may have been re-created under its new place, so it is found again by its marks.
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return;
    const want = refocus.current;
    refocus.current = null;
    if (want !== null) {
      const found = Array.from(el.querySelectorAll<HTMLElement>(`[${BAR_UNIT}]`)).find((unit) => unit.getAttribute(BAR_UNIT) === want.key && (unit.getAttribute(BAR_IN) ?? '') === want.container);
      if (found && !found.contains(document.activeElement)) focusableOf(found).focus();
    }
    const keys = enabled ? (vertical ? 'Alt+ArrowUp Alt+ArrowDown' : 'Alt+ArrowLeft Alt+ArrowRight') : null;
    for (const unit of el.querySelectorAll<HTMLElement>(`[${BAR_UNIT}]`)) {
      const control = focusableOf(unit);
      if (keys === null || entersText(control)) control.removeAttribute('aria-keyshortcuts');
      else control.setAttribute('aria-keyshortcuts', keys);
    }
  });

  const onKeyDownCapture = (e: ReactKeyboardEvent): void => {
    const el = root.current;
    const { order: was = {}, onReorder: done, keysOf: listOf } = latest.current;
    if (done === undefined || el === null) return;
    const [backKey, onKey] = vertical ? ['ArrowUp', 'ArrowDown'] : inlineDirection(el) === 'rtl' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
    const delta = nudgeOf(e, backKey, onKey);
    if (delta === null) return;
    const back = delta < 0;
    const target = e.target as Element;
    // A dock's handle answers to Alt+arrows itself, moving the whole bar.
    if (entersText(target) || target.closest?.(`[${BAR_LEAD}]`)) return;
    const grabbed = target.closest?.(`[${BAR_UNIT}]`);
    if (!grabbed || !el.contains(grabbed)) return;
    const { container, key } = grabbedUnit(grabbed, e.shiftKey);
    const units = containerUnits(el, container, () => 0);
    const from = units.findIndex((unit) => unit.key === key);
    const to = from + (back ? -1 : 1);
    const neighbor = units[to];
    if (from < 0 || neighbor === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const next = movedInto(was, container, listOf?.(container), units, from, { unit: neighbor, after: !back });
    if (next === was) return;
    refocus.current = { container: grabbed.getAttribute(BAR_IN) ?? '', key: grabbed.getAttribute(BAR_UNIT)! };
    setAnnouncement(`${nameOf(units[from]!.els[0]!)}, ${to + 1} of ${units.length}`);
    done(next);
  };

  return { onKeyDownCapture, announcement };
}
