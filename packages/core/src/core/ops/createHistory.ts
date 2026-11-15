import {
  createHistory as createHistoryEngine,
  type History,
  type CreateHistoryOptions as EngineHistoryOptions,
  type HistoryLogger,
} from '@weasel-js/history';
import { defaultOpRegistry, type OpRegistry } from './registry';
import { dlog, dwarn } from '../../debug/flag';

/** Routes the engine's diagnostics into the kit's `history` debug namespace,
 *  so `localStorage.setItem('weasel.debug', '1')` still surfaces them. */
const kitLogger: HistoryLogger = {
  log: (message) => dlog('history', message),
  warn: (message) => dwarn('history', message),
};

/** `@weasel-js/history`'s options, plus the op registry a restore resolves names through. */
export interface CreateHistoryOptions extends EngineHistoryOptions {
  /** Where `restore()` finds the factory for each op name a caller-supplied `rebuildOp` does not
   *  answer. Defaults to `defaultOpRegistry`. */
  opRegistry?: OpRegistry;
}

/**
 * Build an op-batched undo/redo `History` that restores ops through an op
 * registry (`opRegistry`, else `defaultOpRegistry`) and logs to the kit's
 * debug namespace. A caller-supplied `rebuildOp` is asked first; return
 * `null` from it to fall through to the registry.
 */
export function createHistory(adapter: unknown, options: CreateHistoryOptions = {}): History {
  const { opRegistry = defaultOpRegistry, rebuildOp: custom, ...rest } = options;
  return createHistoryEngine(adapter, {
    debug: kitLogger,
    ...rest,
    rebuildOp: (name, args, context) => custom?.(name, args, context) ?? opRegistry.rebuild(name, args),
  });
}
