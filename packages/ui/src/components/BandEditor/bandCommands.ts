import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { focusedControlOwnsKey, isEditableTarget, isPrimaryPress } from '@weasel-js/gestures';
import { bandBounds, mergeBand, splitBands, toggleLock, type Band } from './bands';

/** The band key `e` presses: `x` or Delete merges, `l` locks, `s` splits. Null with a modifier held: `x` is a bare
 *  letter and Cmd/Ctrl+X is cut, which must not be swallowed. Caps Lock reports the letters capitalized with no Shift. */
function bandKey(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): 'x' | 'l' | 's' | 'Delete' | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return key === 'x' || key === 'l' || key === 's' || key === 'Delete' ? key : null;
}

/** What the one-shot edits read, all of it as of this render. */
export interface BandCommandInputs<T> {
  committed: Band<T>[];
  min: number;
  max: number;
  selectedIndex: number | null | undefined;
  onSelectionChange?: (index: number) => void;
  onChange: (next: Band<T>[]) => void;
  /** Locking is offered only where the range can be rescaled, the one thing a lock holds against. */
  canLock: boolean;
  splitBand: (at: number, from: T) => T;
  /** Track position as drawn, `[0, 1]`, and back. */
  toUnit: (value: number) => number;
  fromUnit: (unit: number) => number;
  /** The pointer's track position, clamped to `[0, 1]`. */
  unitAt: (clientX: number) => number;
}

/**
 * What a band editor does on a press, a focus or a key that is not a drag: selecting a band, and the one-shot
 * edits, each a single `onChange` — splitting from the ruler or `s`, locking from a right-click or `l`, and merging
 * from `x` or Delete — which keep the selection on the band it was on.
 */
export function createBandCommands<T>(inputs: BandCommandInputs<T>) {
  const { committed, min, max, selectedIndex, onSelectionChange, onChange, toUnit, fromUnit } = inputs;

  const splitAt = (at: number): boolean => {
    const next = splitBands(committed, at, min, max, inputs.splitBand);
    if (next === committed) return false;
    onChange(next);
    // The new band takes the next index, so a selection to its right moves up one to stay on its band.
    const split = committed.filter((b) => b.from < at).length - 1;
    if (selectedIndex !== null && selectedIndex !== undefined && selectedIndex > split) onSelectionChange?.(selectedIndex + 1);
    return true;
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isPrimaryPress(e)) return;
    e.preventDefault();
    splitAt(fromUnit(inputs.unitAt(e.clientX)));
  };

  const onBandPointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (isPrimaryPress(e) && index !== selectedIndex) onSelectionChange?.(index);
  };

  const onBandFocus = (index: number) => (): void => { if (index !== selectedIndex) onSelectionChange?.(index); };

  const onBandContextMenu = (index: number) => (e: ReactMouseEvent<HTMLButtonElement>): void => {
    if (!inputs.canLock) return;
    e.preventDefault();
    onChange(toggleLock(committed, index));
  };

  const mergeSelected = (e: ReactKeyboardEvent<HTMLDivElement>, selected: number): void => {
    const next = mergeBand(committed, selected);
    if (next === committed) return;
    e.preventDefault();
    const root = e.currentTarget;
    const merged = root.querySelector(`[data-band-index="${selected}"]`);
    const absorbing = root.querySelector<HTMLElement>(`[data-band-index="${selected - 1}"]`);
    onChange(next);
    // Focusing a band selects it, so a merged band that held focus hands over both at once.
    if (absorbing && merged?.contains(root.ownerDocument.activeElement)) absorbing.focus();
    else onSelectionChange?.(selected - 1);
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const key = bandKey(e);
    if (key === null) return;
    if (isEditableTarget(e.target) || focusedControlOwnsKey(e.nativeEvent)) return;
    if (selectedIndex === null || selectedIndex === undefined) return;
    if (key === 'l') {
      if (!inputs.canLock) return;
      e.preventDefault();
      onChange(toggleLock(committed, selectedIndex));
      return;
    }
    if (key === 's') {
      // The middle of the band as drawn, so on a log scale the halves look equal.
      const [from, to] = bandBounds(committed, selectedIndex, min, max);
      if (splitAt(fromUnit((toUnit(from) + toUnit(to)) / 2))) e.preventDefault();
      return;
    }
    mergeSelected(e, selectedIndex);
  };

  return { onTrackPointerDown, onBandPointerDown, onBandFocus, onBandContextMenu, onRootKeyDown };
}
