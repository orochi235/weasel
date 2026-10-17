/**
 * Ports with several places, as ordering and placement read them.
 *
 * The router takes whichever of a port's places faces the wire's next point,
 * which is known only once everything is placed. Ordering stands in for that
 * with where the wire's other end falls among the node's other wires on that
 * side, so a node's own wires leave it in the order their other ends sit.
 */
import type { Hop, Rows } from './types';

/** Each node's neighbors through hops, on the side toward later ranks and on
 *  the side toward earlier ones, one entry per hop. */
export interface Sides {
  down: ReadonlyMap<string, readonly string[]>;
  up: ReadonlyMap<string, readonly string[]>;
}

/** {@link Sides} for `hops`. */
export function sidesOf(hops: readonly Hop[]): Sides {
  const down = new Map<string, string[]>();
  const up = new Map<string, string[]>();
  for (const h of hops) {
    (down.get(h.from) ?? down.set(h.from, []).get(h.from)!).push(h.to);
    (up.get(h.to) ?? up.set(h.to, []).get(h.to)!).push(h.from);
  }
  return { down, up };
}

/**
 * Where a port of several `places` sits for a hop to `other`: the place
 * nearest where `other` falls among `neighbors`, the node's hop ends on that
 * side, read 0 to 1 in order. The earlier of two as near.
 */
export function placeAmong(
  places: readonly number[],
  other: string,
  neighbors: readonly string[],
  pos: ReadonlyMap<string, number>,
): number {
  const p = pos.get(other) ?? 0;
  let before = 0;
  let level = 0;
  for (const n of neighbors) {
    const q = pos.get(n) ?? 0;
    if (q < p) before++;
    else if (q === p) level++;
  }
  const count = Math.max(neighbors.length, 1);
  const expected = (before + Math.max(level, 1) / 2) / count;
  let best = places[0]!;
  for (const at of places) if (Math.abs(at - expected) < Math.abs(best - expected)) best = at;
  return best;
}

/** `hops` with each port of several places settled where {@link placeAmong}
 *  puts it in `rows`' order, for placement, which reads only `fromAt` and
 *  `toAt`. */
export function settlePlaces(rows: Rows, hops: readonly Hop[]): Hop[] {
  if (!hops.some((h) => h.fromPlaces !== undefined || h.toPlaces !== undefined)) return [...hops];
  const pos = new Map<string, number>();
  for (const row of rows) row.forEach((n, i) => pos.set(n.id, i));
  const sides = sidesOf(hops);
  return hops.map((h) => {
    if (h.fromPlaces === undefined && h.toPlaces === undefined) return h;
    const { fromPlaces, toPlaces, ...rest } = h;
    return {
      ...rest,
      ...(fromPlaces !== undefined ? { fromAt: placeAmong(fromPlaces, h.to, sides.down.get(h.from) ?? [], pos) } : {}),
      ...(toPlaces !== undefined ? { toAt: placeAmong(toPlaces, h.from, sides.up.get(h.to) ?? [], pos) } : {}),
    };
  });
}
