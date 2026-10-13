/** One step of a walk over a group's children: a child on its own, or the neighboring `tab` children that share one strip. */
export type PrefTabRun<T> = { item: T; tabs?: undefined } | { tabs: readonly T[]; item?: undefined };

/**
 * `items` in order, each run of neighbors `isTab` holds for folded into one step. What a surface leaves out of
 * `items` neither joins a run nor ends one, and what it keeps and then declines to draw still holds its run together.
 */
export function prefTabRuns<T>(items: readonly T[], isTab: (item: T) => boolean): PrefTabRun<T>[] {
  const out: PrefTabRun<T>[] = [];
  let run: T[] | undefined;
  for (const item of items) {
    if (!isTab(item)) {
      run = undefined;
      out.push({ item });
    } else if (run) {
      run.push(item);
    } else {
      out.push({ tabs: (run = [item]) });
    }
  }
  return out;
}
