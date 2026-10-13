import { useInsertionEffect, useRef } from 'react';

/**
 * A ref holding the `value` of the last **committed** render, for event
 * handlers, frame loops and other code that runs outside render and must not
 * re-subscribe every time `value` changes.
 *
 * Writing `ref.current = value` in a render body is not the same thing: React
 * may start a render and throw it away (a transition that suspends, a render
 * interrupted by a more urgent update), and the value that render computed
 * would stay behind for the next event to read. This writes from
 * `useInsertionEffect`, so only a render that commits ever lands, and it lands
 * before any layout effect in that commit runs.
 *
 * Don't read `.current` during render expecting this render's value: until the
 * commit it holds the previous committed one (on mount, this first `value`).
 * Render code should use `value` itself.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useInsertionEffect(() => {
    ref.current = value;
  });
  return ref;
}
