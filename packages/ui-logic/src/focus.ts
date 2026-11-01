/** How a focus change came about. */
export interface FocusScopeOptions {
  /** Whether the target shows its focus ring: the scope's `:focus-visible`. Keyboard moves show one, a press does
   *  not. Default `false` for {@link FocusScope.focus}, `true` for {@link FocusScope.moveFocus}. */
  readonly visible?: boolean;
}

/**
 * Keyboard focus over a set of targets, whatever draws them: a HUD's widgets and a DOM subtree's elements both
 * answer it, so code that moves or reads focus is written once for either.
 */
export interface FocusScope<T> {
  /** The target holding keyboard focus, or null. One per scope. */
  readonly focused: T | null;
  /** Whether the focused target shows its focus ring. */
  readonly focusVisible: boolean;
  /** Focus `target`, or blur with `null`. Returns whether `target` now holds focus: false when it is not in this
   *  scope or cannot take focus, and focus is then unchanged. */
  focus(target: T | null, options?: FocusScopeOptions): boolean;
  /** Move focus one step through {@link tabOrder}. From nothing, `'next'` lands on the first target and `'prev'` on
   *  the last; past either end the scope blurs and returns null, which is where focus leaves it. */
  moveFocus(direction: 'next' | 'prev', options?: FocusScopeOptions): T | null;
  /** The targets Tab visits, in order. */
  tabOrder(): T[];
  /** Run `fn` whenever the focused target changes. Returns an unsubscribe. */
  subscribeFocus(fn: (focused: T | null) => void): () => void;
}

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
