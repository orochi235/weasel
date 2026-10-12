import type { Op } from 'core/ops/types';
import { dwarn } from 'debug/flag';

/** Rebind an external op to the adapter supplied at the `applyBatch` call
 *  site — the scene's engine was constructed without an adapter, so ops
 *  it stores and later replays must close over the right one. Forwards
 *  the apply return value (no-op detection) and preserves
 *  `coalesceKey`/`name`/`args`/`label` for coalescing and eviction. See
 *  `bindOpToHistoryAdapter` for RESTORED entries (lazy accessor). */
export function bindOpToAdapter(op: Op, adapter: unknown): Op {
  return {
    name: op.name,
    args: op.args,
    label: op.label,
    // Read when asked: an arrange op has no key until it has applied.
    get coalesceKey() { return op.coalesceKey; },
    elideNoop: op.elideNoop,
    apply: () => op.apply(adapter),
    invert: () => bindOpToAdapter(op.invert(), adapter),
  };
}

/** Wrap a globally-rebuilt external op so apply resolves the history
 *  adapter lazily — wiring order vs restoreHistory doesn't matter. An
 *  unset accessor makes the op a debug-warned no-op, and an apply that
 *  throws (e.g. the wired adapter lacks a method the op calls) degrades
 *  the same way — never throws mid-undo, matching the placeholder
 *  degradation policy. (The engine pops entries before applying, so an
 *  uncaught throw would corrupt the stacks.) See `bindOpToAdapter` for
 *  the live `applyBatch` path (fixed call-site adapter). */
export function bindOpToHistoryAdapter(op: Op, accessor: () => (() => unknown) | null): Op {
  return {
    name: op.name,
    args: op.args,
    label: op.label,
    get coalesceKey() { return op.coalesceKey; },
    elideNoop: op.elideNoop,
    apply: () => {
      const get = accessor();
      if (!get) {
        dwarn('scene', `restored op "${op.name ?? '?'}" has no history adapter — skipping (setHistoryAdapter was not wired)`);
        return 'noop';
      }
      try {
        return op.apply(get());
      } catch (err) {
        dwarn('scene', `restored op "${op.name ?? '?'}" failed against the history adapter — skipping: ${String(err)}`);
        return 'noop';
      }
    },
    invert: () => bindOpToHistoryAdapter(op.invert(), accessor),
  };
}
