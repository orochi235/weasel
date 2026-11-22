import { useState } from 'react';
import type { GradStop } from '@weasel-js/paint';

/** Stop indexes in the order the stops sit along the gradient; stops at one offset keep their stored order. */
export function stopOrder(stops: readonly GradStop[]): number[] {
  return stops.map((_, index) => index).sort((a, b) => stops[a].offset - stops[b].offset || a - b);
}

/** Which stop the editor is on, and how that moves when the list changes. Stops are named by their index in `stops`. */
export interface StopSelection {
  selected: number;
  /** `report` tells the caller even when the index is unchanged, because another stop now holds it. */
  select: (index: number, report?: boolean) => void;
  /** Where the selection goes once `index` is removed, as an index into the shorter list, and whether the selected stop is the one removed. */
  afterRemoval: (index: number) => { next: number; lost: boolean };
}

/**
 * The selected stop, held here unless the caller passes one. It starts on the
 * first stop along the gradient, and a selection that names no stop — the list
 * shrank under it — reads as that one too.
 */
export function useStopSelection(
  stops: readonly GradStop[],
  controlled: number | undefined,
  onSelect: ((index: number) => void) | undefined,
): StopSelection {
  const order = stopOrder(stops);
  const [own, setOwn] = useState(order[0]);
  const asked = controlled ?? own;
  const selected = asked >= 0 && asked < stops.length ? asked : order[0];

  const select = (index: number, report = false): void => {
    if (index === asked && !report) return;
    setOwn(index);
    onSelect?.(index);
  };

  const afterRemoval = (index: number): { next: number; lost: boolean } => {
    // Losing the selected stop hands the selection to the stop before it, or to the one after the first.
    const place = order.indexOf(index);
    const lost = index === selected;
    const keep = lost ? order[place > 0 ? place - 1 : 1] : selected;
    return { next: keep > index ? keep - 1 : keep, lost };
  };

  return { selected, select, afterRemoval };
}
