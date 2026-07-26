/**
 * `useDispatcherDepSource` — wires the `dispatcher` dep so actions can
 * abort in-flight handles (`cancelGestureAction` is the kit's only
 * built-in consumer today; consumer-app actions wanting drag-cancel
 * semantics use the same surface).
 *
 * Exposes only the control methods actions might legitimately need —
 * `cancelAll(reason)` — not the full dispatcher API. Keeps the dep's
 * blast radius narrow.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';

export function useDispatcherDepSource(dispatcher: Dispatcher): void {
  const ref = useRef(dispatcher);
  ref.current = dispatcher;

  useDepSource('dispatcher', () => ({
    cancelAll: (reason) => ref.current.cancelAll(reason),
  }));
}
