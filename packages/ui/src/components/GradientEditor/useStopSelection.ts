import { useState } from 'react';
import type { GradStop } from '@weasel-js/core';

/** Stop indexes in the order the stops sit along the gradient; stops at one offset keep their stored order. */
export function stopOrder(stops: readonly GradStop[]): number[] {
  return stops.map((_, index) => index).sort((a, b) => stops[a].offset - stops[b].offset || a - b);
}

/** Which stop the editor is on, and how that moves when the list changes. Stops are named by their index in `stops`. */
export interface StopSelection {
  selected: number;
  select: (index: number) => void;
  /** Moves the selection for the removal of `index` and returns where it went, as an index into the shorter list. */
  removing: (index: number) => number;
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

  const select = (index: number): void => {
    if (index === selected) return;
    setOwn(index);
    onSelect?.(index);
  };

  const removing = (index: number): number => {
    // Losing the selected stop hands the selection to the stop before it, or to the one after the first.
    const place = order.indexOf(index);
    const keep = index === selected ? order[place > 0 ? place - 1 : 1] : selected;
    const next = keep > index ? keep - 1 : keep;
    select(next);
    return next;
  };

  return { selected, select, removing };
}
