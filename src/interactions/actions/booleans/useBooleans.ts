/**
 * `useBooleans` — selection-driven Boolean ops on path layers.
 *
 * Returns five imperative callables (`union` / `intersect` / `subtract` /
 * `exclude` / `divide`). Each reads the current selection, performs the op
 * in world space, and dispatches a single batch through the adapter's
 * `applyOps` (one undo step).
 *
 * Adapter shape: see `BooleansAdapter` in `./booleans.ts`. Consumers
 * supply how to read selection, fetch the world-space `Path` for an id,
 * compare ids by stacking order, and mint a node from a result `Path`.
 *
 * No-ops are silent in production; in dev, `subtract` with < 2 selected
 * paths emits a `console.warn`.
 */
import { useCallback, useEffect, useRef } from 'react';
import { applyBooleanOp, type BooleansAdapter, type BooleanOp } from './booleans';
import { useActionsRegistry } from '../registry';
import { defaultBooleanActions } from '../defaults/booleans';

export interface UseBooleansReturn {
  union(): void;
  intersect(): void;
  subtract(): void;
  exclude(): void;
  divide(): void;
}

export interface UseBooleansOptions {
  /** When true (default), auto-register the five Pathfinder actions
   *  (`pathfinder.{union,intersect,subtract,exclude,divide}`) with the
   *  ambient `ActionsProvider`. No-op when no provider is in scope. */
  enableActions?: boolean;
}

const isDev = typeof import.meta !== 'undefined'
  && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function useBooleans(
  adapter: BooleansAdapter,
  options: UseBooleansOptions = {},
): UseBooleansReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const reg = useActionsRegistry();
  const enableActions = options.enableActions ?? true;
  useEffect(() => {
    if (!reg || !enableActions) return;
    const actions = defaultBooleanActions({
      getSelection: () => adapterRef.current.getSelection(),
      getWorldPath: (id) => adapterRef.current.getWorldPath(id),
      compareZ: (a, b) => adapterRef.current.compareZ(a, b),
      createPathNode: (path, op) => adapterRef.current.createPathNode(path, op),
      getNode: (id) => adapterRef.current.getNode?.(id),
      getZOrder: (id) => adapterRef.current.getZOrder?.(id),
      applyOps: (ops, label) => adapterRef.current.applyOps?.(ops, label),
      setSelection: (ids) => adapterRef.current.setSelection?.(ids),
      insertNode: (node) => adapterRef.current.insertNode?.(node),
      removeNode: (id) => adapterRef.current.removeNode?.(id),
    });
    const unregs = actions.map((act) => reg.register(act));
    return () => { for (const u of unregs) u(); };
  }, [reg, enableActions]);

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
