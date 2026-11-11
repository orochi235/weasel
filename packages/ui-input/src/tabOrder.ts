/** Tab order: targets that declare a place come first, ascending, then the rest in the order given. In the DOM a
 *  positive `tabindex` declares one and `0` does not. */
export function tabSort<T>(targets: readonly T[], declared: (target: T) => number | undefined): T[] {
  const key = (t: T) => declared(t) ?? Number.POSITIVE_INFINITY;
  // Array.prototype.sort is stable, so ties and the undeclared keep the given order.
  return [...targets].sort((a, b) => key(a) - key(b));
}

/** The target one Tab step from `from` through `order`, or null past either end. From nothing, `'next'` is the
 *  first and `'prev'` the last. A `from` that is out of the order (hidden since it took focus, say) steps from where
 *  it sits, which `isBefore` says; without it, such a `from` steps as nothing does. */
export function tabStep<T>(
  order: readonly T[], from: T | null, direction: 'next' | 'prev', isBefore?: (a: T, b: T) => boolean,
): T | null {
  const forward = direction === 'next';
  const here = from === null ? -1 : order.indexOf(from);
  let at: number;
  if (here !== -1) at = here + (forward ? 1 : -1);
  else if (from === null || !isBefore) at = forward ? 0 : order.length - 1;
  else {
    const after = order.findIndex((t) => isBefore(from, t));
    const end = after === -1 ? order.length : after;
    at = forward ? end : end - 1;
  }
  return order[at] ?? null;
}
