import {
  createHistory as createHistoryEngine,
  type History,
  type CreateHistoryOptions,
  type HistoryLogger,
} from '@weasel-js/history';
import { rebuildOp } from './registry';
import { dlog, dwarn } from '../../debug/flag';

/** Routes the engine's diagnostics into the kit's `history` debug namespace,
 *  so `localStorage.setItem('weasel.debug', '1')` still surfaces them. */
const kitLogger: HistoryLogger = {
  log: (message) => dlog('history', message),
  warn: (message) => dwarn('history', message),
};

/**
 * Build an op-batched undo/redo `History`, defaulting restore-time op
 * hydration to core's global op-factory registry and its diagnostics to the
 * kit's debug namespace.
 *
 * The engine in `@weasel-js/history` is registry-agnostic: it can only rebuild
 * a serialized `(name, args)` pair through the `rebuildOp` hook it is handed,
 * which is what lets that package build without depending on core. Core owns
 * the registry, so this wrapper supplies it — meaning `createHistory(adapter)`
 * with no options still restores kit-emitted ops, exactly as before.
 *
 * A caller-supplied `rebuildOp` wins; return `null` from it to fall through to
 * the registry.
 */
export function createHistory(adapter: unknown, options: CreateHistoryOptions = {}): History {
  const custom = options.rebuildOp;
  return createHistoryEngine(adapter, {
    debug: kitLogger,
    ...options,
    rebuildOp: (name, args) => custom?.(name, args) ?? rebuildOp(name, args),
  });
}
