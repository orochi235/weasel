import type { Op } from './ops/types';

/**
 * Default `applyOps` implementation: apply each op in order against
 * `adapter`. Used by hooks when an adapter omits `applyOps`. Apps that
 * need history integration (checkpoint + push entry) supply their own
 * `applyOps` instead.
 *
 * The `_label` parameter mirrors the `applyOps(ops, label)` signature so
 * call-sites can dispatch through `(adapter.applyOps ?? applyOpsTo)` with
 * matching arguments. The default ignores it.
 */
export function applyOpsTo<A>(adapter: A, ops: Op[], _label?: string): void {
  for (const op of ops) op.apply(adapter);
}

/**
 * Dispatcher: invokes `adapter.applyOps` if present, otherwise falls back
 * to `applyOpsTo`. Convenience for hooks so they don't repeat the
 * `?? applyOpsTo` pattern at every call site.
 */
export function dispatchApplyBatch<A>(
  adapter: A,
  ops: Op[],
  label?: string,
): void {
  const a = adapter as { applyOps?: (ops: Op[], label?: string) => void };
  if (a.applyOps) a.applyOps(ops, label);
  else applyOpsTo(adapter, ops, label);
}
