import type { PlotData } from '@weasel-js/plot';
import { useRef } from 'react';

/** What an edit does to the rows' order: the ids before it, to the ids after. */
export type RowShift = (ids: readonly string[], fresh: () => string) => string[];

export const insertedAt = (at: number): RowShift => (ids, fresh) => [...ids.slice(0, at), fresh(), ...ids.slice(at)];
export const removedAt = (at: number): RowShift => (ids) => ids.filter((_, i) => i !== at);
export const movedTo = (from: number, to: number): RowShift => (ids) => {
  const next = ids.filter((_, i) => i !== from);
  next.splice(to, 0, ids[from]!);
  return next;
};

/**
 * An id for each of a table's `count` rows that stays with its item through the panel's own inserts, removals and
 * moves, so what a row holds open follows the item rather than its slot. `track` wraps an edit with what it does to
 * the order; the order shifts only once `data` comes back as that edit made it, so an edit the host drops shifts
 * nothing. A change from elsewhere keeps the ids by position.
 */
export function useRowIds(data: PlotData, count: number): {
  ids: readonly string[];
  track: (change: (d: PlotData) => PlotData, shift: RowShift) => (d: PlotData) => PlotData;
} {
  const state = useRef({ ids: [] as string[], made: 0, seen: undefined as PlotData | undefined, pending: [] as { made: PlotData; shift: RowShift }[] });
  const s = state.current;
  const fresh = (): string => `row-${s.made++}`;
  if (s.seen !== data) {
    const mine = s.pending.find((p) => p.made === data);
    if (mine) s.ids = mine.shift(s.ids, fresh);
    s.pending = [];
    s.seen = data;
  }
  if (s.ids.length !== count) s.ids = Array.from({ length: count }, (_, i) => s.ids[i] ?? fresh());
  return {
    ids: s.ids,
    track: (change, shift) => (d) => {
      const made = change(d);
      s.pending.push({ made, shift });
      return made;
    },
  };
}
