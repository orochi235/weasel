/** Per animator and pose-tween namespace, a stop for each node a transition is running or
 *  waiting to run, with the first transition of its chain. A tween started under a cancelKey
 *  cancels the one holding it without running its `onDone`, so a transition reaching a node
 *  stops the other chains there itself, or theirs would never end. */
const LIVE_ITEMS = new WeakMap<object, Map<string, Map<() => void, object>>>();

/** Hold `stop` as running on the node `ns` names, for the chain whose first transition is `root`. */
export function trackItem(animator: object, ns: string, stop: () => void, root: object): void {
  const byNs = LIVE_ITEMS.get(animator) ?? new Map<string, Map<() => void, object>>();
  LIVE_ITEMS.set(animator, byNs);
  if (!byNs.has(ns)) byNs.set(ns, new Map());
  byNs.get(ns)!.set(stop, root);
}

export function untrackItem(animator: object, ns: string, stop: () => void): void {
  const byNs = LIVE_ITEMS.get(animator);
  const live = byNs?.get(ns);
  if (!byNs || !live) return;
  live.delete(stop);
  if (live.size === 0) byNs.delete(ns);
}

/** @internal Interrupt every transition on the node `ns` names, except those of `except`'s chain. */
export function interruptNode(animator: object, ns: string, except?: object): void {
  const live = LIVE_ITEMS.get(animator)?.get(ns);
  if (!live) return;
  for (const [stop, root] of [...live]) if (root !== except) stop();
}
