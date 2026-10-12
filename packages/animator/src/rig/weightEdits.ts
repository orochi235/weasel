import type { Skin } from './skin';

/**
 * `skin` with `joint`'s weight set on some points: `weights` maps a point's index to the new
 * weight, clamped to 0..1. On each of those points the other joints are scaled to share what
 * is left, so the point still sums to 1; a point no other joint weighs goes wholly to `joint`,
 * as it would when the skin is applied. Every array comes back `count` long, and a joint left
 * weighing nothing is dropped.
 */
export function setWeights(
  skin: Skin,
  count: number,
  joint: string,
  weights: ReadonlyMap<number, number>,
): Skin {
  const next: Record<string, number[]> = {};
  for (const name in skin) next[name] = Array.from({ length: count }, (_, i) => skin[name][i] ?? 0);
  const own = (next[joint] ??= new Array<number>(count).fill(0));
  for (const [i, raw] of weights) {
    if (i < 0 || i >= count) continue;
    const w = Math.min(1, Math.max(0, raw));
    let others = 0;
    for (const name in next) if (name !== joint) others += next[name][i];
    if (others > 0) {
      for (const name in next) if (name !== joint) next[name][i] *= (1 - w) / others;
      own[i] = w;
    } else {
      own[i] = w > 0 ? 1 : 0;
    }
  }
  for (const name in next) if (!next[name].some((w) => w > 0)) delete next[name];
  return next;
}

/**
 * What a round brush at `(x, y)` does to one joint's weights: for each point of `coords`
 * within `radius`, a weight falling off linearly from the center. `'add'` raises a point
 * toward 1 and `'remove'` lowers it toward 0; neither moves a point the other way. Answers
 * only the points that change, by index, for {@link setWeights}.
 */
export function brushWeights(
  coords: ArrayLike<number>,
  x: number,
  y: number,
  radius: number,
  current: readonly number[] | undefined,
  mode: 'add' | 'remove',
): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; 2 * i + 1 < coords.length; i++) {
    const d = Math.hypot(coords[2 * i] - x, coords[2 * i + 1] - y);
    if (d >= radius) continue;
    const had = current?.[i] ?? 0;
    const want = mode === 'add' ? Math.max(had, 1 - d / radius) : Math.min(had, d / radius);
    if (want !== had) out.set(i, want);
  }
  return out;
}
