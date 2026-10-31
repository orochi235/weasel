import { bandBounds, type Band } from './bands';
import type { DraftGhostAt } from './DraftGhost';

/** Whether two band lists of one length put every seam in the same place. */
export function sameSeams<T>(a: readonly Band<T>[], b: readonly Band<T>[]): boolean {
  return a.length === b.length && a.every((band, i) => i === 0 || band.from === b[i]!.from);
}

/**
 * Where a seam drag started, read off the seams it moved: one seam is a line
 * at its old place, two neighbors are the band between them, dragged whole.
 * Null when nothing moved.
 */
export function seamGhost<T>(committed: readonly Band<T>[], next: readonly Band<T>[], min: number, max: number): DraftGhostAt | null {
  const moved: number[] = [];
  for (let i = 1; i < committed.length; i++) if (committed[i]!.from !== next[i]?.from) moved.push(i);
  if (moved.length === 1) return { at: committed[moved[0]!]!.from };
  if (moved.length === 2 && moved[1] === moved[0]! + 1) {
    const [from, to] = bandBounds(committed, moved[0]!, min, max);
    return { from, to };
  }
  return null;
}
