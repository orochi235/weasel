/** One step of a walk over a group's children: a child on its own, or the neighboring `tab` children that share one strip. */
export type PrefTabRun<T> = { item: T; tabs?: undefined } | { tabs: readonly T[]; item?: undefined };

/**
 * `items` in order, each run of neighbors `isTab` holds for folded into one step. An item `draws` says has nothing to
 * draw (a tab with no visible rows, say) is left out: it neither joins a run nor ends one. Every params surface asks
 * this one walk which tabs share a strip, each with its own `draws`.
 */
export function prefTabRuns<T, U extends T>(items: readonly T[], isTab: (item: U) => boolean, draws: (item: T) => item is U): PrefTabRun<U>[];
export function prefTabRuns<T>(items: readonly T[], isTab: (item: T) => boolean, draws?: (item: T) => boolean): PrefTabRun<T>[];
export function prefTabRuns<T>(items: readonly T[], isTab: (item: T) => boolean, draws?: (item: T) => boolean): PrefTabRun<T>[] {
  const out: PrefTabRun<T>[] = [];
  let run: T[] | undefined;
  for (const item of items) {
    if (draws && !draws(item)) continue;
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
