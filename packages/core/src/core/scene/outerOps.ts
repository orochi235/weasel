/**
 * Ops built outside the scene and handed to `applyBatch` or `scene.history`.
 *
 * An undo entry holds the scene's own ops, so an outer op is recorded as the
 * kit ops it caused. One that wrote no scene state is recorded as itself, and
 * needs an adapter to replay through: the one it was applied with, or after a
 * reload the one `setHistoryAdapter` supplies.
 */
import type { History, Journal } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { rebuildOp as rebuildGlobalOp } from 'core/ops/registry';
import { bindOpToAdapter, bindOpToHistoryAdapter } from './boundOps';
import type { Recorder } from './recorder';

/** What the outer ops need from the scene they are applied to. */
export interface OuterOpsEnv {
  /** The scene's own op for a kind it has registered, or `null`. */
  own(name: string, args: unknown): Op | null;
  /** The scene's recorder, built after this is. */
  recorder(): Pick<Recorder, 'capturing' | 'joins' | 'join'>;
  /** Run a step that applies ops through a history engine: all-or-nothing,
   *  unrecorded by the scene, with subscribers called once after. */
  driving(step: () => void): void;
  /** Where `applyBatch` looks for an open journal until an accessor is set. */
  getActiveJournal: (() => Journal | null) | null;
  /** The innermost journal opened through `scene.history`, which edits go to
   *  ahead of the accessor's: it is opened inside that one, if anything. */
  openJournal(): Journal | null;
}

export interface OuterOps {
  /** The op a restored history names: the scene's own, or an outer op bound
   *  to the adapter `setHistoryAdapter` supplies. `null` when nothing knows
   *  the name, and the engine places its no-op placeholder. */
  rebuild(name: string, args: unknown): Op | null;
  /** `op` as an engine applies it: its entry records the kit ops it caused,
   *  or the op itself when it caused none. */
  causing(op: Op): Op;
  /** Apply `ops` against `adapter` as one entry: part of the open `batch`
   *  when there is one, else on the active journal, else on `engine`. */
  apply(engine: History, ops: Op[], label: string, adapter: unknown): void;
  setHistoryAdapter(fn: (() => unknown) | null): void;
  setActiveJournalAccessor(fn: (() => Journal | null) | null): void;
  /** The journal edits go to now, or null for the scene's own history. */
  activeJournal(): Journal | null;
}

/** A kit op under the key of the outer op that caused it, so two edits merge
 *  when their outer ops would have. */
function keyed(kit: Op, outerKey: string | undefined): Op {
  const key = outerKey === undefined || kit.coalesceKey === undefined ? undefined : `${outerKey}>${kit.coalesceKey}`;
  return { name: kit.name, args: kit.args, coalesceKey: key, apply: kit.apply, invert: kit.invert };
}

export function createOuterOps(env: OuterOpsEnv): OuterOps {
  let historyAdapter: (() => unknown) | null = null;
  let activeJournal = env.getActiveJournal;

  function causing(op: Op, given: Op = op): Op {
    if (op.caused) return op;
    let caused: Op[] = [given];
    return {
      get name() { return op.name; },
      get args() { return op.args; },
      label: op.label,
      // Read when asked: an arrange op has no key until it has applied.
      get coalesceKey() { return op.coalesceKey; },
      elideNoop: op.elideNoop,
      apply(adapter) {
        const { result, ops } = env.recorder().capturing(() => given.apply(adapter));
        if (ops.length > 0) caused = ops.map((kit) => keyed(kit, op.coalesceKey));
        return result;
      },
      caused: () => caused,
      invert: () => given.invert(),
    };
  }

  return {
    rebuild(name, args) {
      const own = env.own(name, args);
      if (own !== null) return own;
      const rebuilt = rebuildGlobalOp(name, args);
      return rebuilt === null ? null : bindOpToHistoryAdapter(rebuilt, () => historyAdapter);
    },
    causing: (op) => causing(op),
    apply(engine, ops, label, adapter) {
      if (env.recorder().joins()) return env.recorder().join(ops, adapter);
      const journal = env.openJournal() ?? activeJournal?.() ?? null;
      env.driving(() => {
        // Neither engine was built with an adapter, so an op is bound to
        // this call's before either applies or stores it.
        const bound = ops.map((op) => causing(op, bindOpToAdapter(op, adapter)));
        if (journal) journal.applyBatch(bound, label);
        else engine.applyOps(bound, label);
      });
    },
    setHistoryAdapter(fn) {
      historyAdapter = fn;
    },
    setActiveJournalAccessor(fn) {
      activeJournal = fn;
    },
    activeJournal: () => env.openJournal() ?? activeJournal?.() ?? null,
  };
}
