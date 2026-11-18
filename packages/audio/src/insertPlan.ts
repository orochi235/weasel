import type { Slot } from './insertSlot';

/** One crossfade: take a slot out of the graph, or splice one in at `at`. */
export type Step =
  | { kind: 'out'; slot: Slot }
  | { kind: 'in'; slot: Slot; at: number };

/** The next step bringing the graph's `live` slots toward the edited `order`, or null once they match. */
export function nextStep(order: readonly Slot[], live: readonly Slot[]): Step | null {
  const stale = live.find((s) => s.removed);
  if (stale) return { kind: 'out', slot: stale };
  const wanted = order.filter((s) => live.includes(s));
  for (let i = 0; i < wanted.length; i += 1) {
    // Out now, back in at its place on a later step.
    if (live[i] !== wanted[i]) return { kind: 'out', slot: wanted[i] };
  }
  const i = order.findIndex((s) => !live.includes(s));
  if (i < 0) return null;
  let at = 0;
  for (let j = i - 1; j >= 0; j -= 1) {
    const k = live.indexOf(order[j]);
    if (k >= 0) { at = k + 1; break; }
  }
  return { kind: 'in', slot: order[i], at };
}
