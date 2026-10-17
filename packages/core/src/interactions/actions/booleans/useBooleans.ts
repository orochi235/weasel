/**
 * `useBooleans` — selection-driven Boolean ops on path layers. No-ops are
 * silent in production; in dev, `subtract` with < 2 selected paths emits a
 * `console.warn`.
 */
import { useCallback } from 'react';
import { useLatest } from '@weasel-js/react';
import { applyBooleanOp, type BooleansAdapter, type BooleanOp } from './booleans';
import type { BooleanOpOptions } from './operands';
import { isDev } from '@weasel-js/react';

/** The Boolean path operations, each acting on the current selection and
 *  committing as one undo step. */
export interface UseBooleansReturn {
  union(): void;
  intersect(): void;
  subtract(): void;
  exclude(): void;
  divide(): void;
  crop(): void;
  trim(): void;
  merge(): void;
}

/** Options for `useBooleans`. */
export interface UseBooleansOptions extends BooleanOpOptions {
  /** No-op. Retained for source-compatibility; `useStandardActions`
   *  registers the actions. */
  enableActions?: boolean;
}

const dev = isDev();

/** Bind the Boolean path operations to an adapter that knows how to read the
 *  selection, fetch world-space paths and mint result nodes. */
export function useBooleans(
  adapter: BooleansAdapter,
  options: UseBooleansOptions = {},
): UseBooleansReturn {
  const adapterRef = useLatest(adapter);
  const optionsRef = useLatest(options);

  const run = useCallback((op: BooleanOp) => {
    const result = applyBooleanOp(adapterRef.current, op, optionsRef.current);
    if (dev && result.kind === 'noop' && result.reason === 'too-few-for-subtract') {
      console.warn('[useBooleans] subtract requires at least 2 selected paths');
    }
  }, [adapterRef, optionsRef]);

  return {
    union: useCallback(() => run('union'), [run]),
    intersect: useCallback(() => run('intersect'), [run]),
    subtract: useCallback(() => run('subtract'), [run]),
    exclude: useCallback(() => run('exclude'), [run]),
    divide: useCallback(() => run('divide'), [run]),
    crop: useCallback(() => run('crop'), [run]),
    trim: useCallback(() => run('trim'), [run]),
    merge: useCallback(() => run('merge'), [run]),
  };
}
