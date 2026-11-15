import type { RebuildContext } from '@weasel-js/history';
import type { Op } from 'core/ops/types';

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

/** A restored external op that could not apply during an undo, redo or goto. The step changed
 *  nothing and its entry stayed where it was. */
export class RestoredOpError extends Error {
  constructor(
    /** The op's name. */
    readonly op: string,
    /** The entry it belongs to, as the restored snapshot numbered it. */
    readonly entry: { readonly id: number; readonly label: string } | undefined,
    /** `'no-adapter'` when `setHistoryAdapter` was cleared; `'threw'` when its apply threw. */
    readonly reason: 'no-adapter' | 'threw',
    options?: { cause?: unknown },
  ) {
    const where = entry ? ` in entry ${entry.id} "${entry.label}"` : '';
    const why = reason === 'no-adapter' ? 'no history adapter is set' : `it threw: ${String(options?.cause)}`;
    super(`Scene: restored op "${op}"${where} cannot apply: ${why}`, options);
    this.name = 'RestoredOpError';
  }
}

/** Wrap an external op rebuilt for a restored history so its apply resolves
 *  the history adapter when it runs. Under strict recovery (or no `context`)
 *  an apply with no adapter, or one that throws, throws `RestoredOpError`, and
 *  the engine keeps the entry where it was. Under best-effort recovery a
 *  missing adapter skips the op and reports it; a throw still throws, since
 *  swallowing it would hide a partial write. */
export function bindOpToHistoryAdapter(op: Op, accessor: () => (() => unknown) | null, context?: RebuildContext): Op {
  const name = op.name ?? '?';
  return {
    name: op.name,
    args: op.args,
    label: op.label,
    get coalesceKey() { return op.coalesceKey; },
    elideNoop: op.elideNoop,
    apply: () => {
      const get = accessor();
      if (!get) {
        if (context?.recovery === 'best-effort') {
          context.skipped(name, op.args, 'no-adapter');
          return 'noop';
        }
        throw new RestoredOpError(name, context?.entry, 'no-adapter');
      }
      try {
        return op.apply(get());
      } catch (err) {
        throw new RestoredOpError(name, context?.entry, 'threw', { cause: err });
      }
    },
    invert: () => bindOpToHistoryAdapter(op.invert(), accessor, context),
  };
}
