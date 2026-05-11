/**
 * `useBooleans` — selection-driven Boolean ops on path layers.
 *
 * Returns five imperative callables (`union` / `intersect` / `subtract` /
 * `exclude` / `divide`). Each reads the current selection, performs the op
 * in world space, and dispatches a single batch through the adapter's
 * `applyBatch` (one undo step).
 *
 * Adapter shape: see `BooleansAdapter` in `./booleans.ts`. Consumers
 * supply how to read selection, fetch the world-space `Path` for an id,
 * compare ids by stacking order, and mint a node from a result `Path`.
 *
 * No-ops are silent in production; in dev, `subtract` with < 2 selected
 * paths emits a `console.warn`.
 */
import { useCallback, useRef } from 'react';
import { applyBooleanOp, type BooleansAdapter, type BooleanOp } from './booleans';

export interface UseBooleansReturn {
  union(): void;
  intersect(): void;
  subtract(): void;
  exclude(): void;
  divide(): void;
}

const isDev = typeof import.meta !== 'undefined'
  && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function useBooleans(adapter: BooleansAdapter): UseBooleansReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const run = useCallback((op: BooleanOp) => {
    const result = applyBooleanOp(adapterRef.current, op);
    if (isDev && result.kind === 'noop' && result.reason === 'too-few-for-subtract') {
      // eslint-disable-next-line no-console
      console.warn('[useBooleans] subtract requires at least 2 selected paths');
    }
  }, []);

  return {
    union: useCallback(() => run('union'), [run]),
    intersect: useCallback(() => run('intersect'), [run]),
    subtract: useCallback(() => run('subtract'), [run]),
    exclude: useCallback(() => run('exclude'), [run]),
    divide: useCallback(() => run('divide'), [run]),
  };
}
