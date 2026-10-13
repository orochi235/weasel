/**
 * The scene's second recorded form: an op built outside the scene, handed to
 * `applyBatch`, and stored on the undo stack as itself rather than as the kit
 * ops it causes.
 *
 * Everything here exists to make such an op replayable beside the scene's
 * own: the adapter it is bound to, the poses written on its behalf, the
 * journal it may be routed to, and how it is rebuilt from a restored history.
 */
import type { History, Journal } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { rebuildOp as rebuildGlobalOp } from 'core/ops/registry';
import { createArrangeOp, type ArrangeArgs } from 'core/ops/arrange';
import { bindOpToAdapter, bindOpToHistoryAdapter } from './boundOps';
import { CARRY_OP, createCarriedPoses, type CarryArgs } from './carriedPoses';
import { asNodeId, type NodeId } from './types';

/** What the outer ops need from the scene they are applied to. */
export interface OuterOpsEnv<TPose> {
  /** The scene's own op for a kind it has registered, or `null`. */
  own(name: string, args: unknown): Op | null;
  /** An op as the stack should hold it: one whose replay skips a node an
   *  untracked edit took. */
  tolerant(op: Op): Op;
  has(id: NodeId): boolean;
  setPose(id: NodeId, pose: TPose): void;
  /** Run a step that applies ops through a history engine: all-or-nothing,
   *  unrecorded by the scene, with subscribers called once after. */
  driving(step: () => void): void;
  /** Where `applyBatch` looks for an open journal until an accessor is set. */
  getActiveJournal: (() => Journal | null) | null;
}

export interface OuterOps<TPose> {
  /** The op a restored history names: the scene's own, or an outer op bound
   *  to the adapter `setHistoryAdapter` supplies. `null` when nothing knows
   *  the name, and the engine places its no-op placeholder. */
  rebuild(name: string, args: unknown): Op | null;
  /** Apply `ops` against `adapter` as one entry, on the active journal when
   *  there is one and on `engine` otherwise. */
  apply(engine: History, ops: Op[], label: string, adapter: unknown): void;
  /** Called by the scene with every pose it writes. */
  wrote(id: NodeId, from: TPose, to: TPose): void;
  carry(id: NodeId, pose: TPose): void;
  setHistoryAdapter(fn: (() => unknown) | null): void;
  setActiveJournalAccessor(fn: (() => Journal | null) | null): void;
}

export function createOuterOps<TPose>(env: OuterOpsEnv<TPose>): OuterOps<TPose> {
  let historyAdapter: (() => unknown) | null = null;
  let activeJournal = env.getActiveJournal;
  const carried = createCarriedPoses<TPose>(env.has, env.setPose);

  function rebuild(name: string, args: unknown): Op | null {
    const own = env.own(name, args);
    if (own !== null) return own;
    // Its writes are the scene's own, so it replays without an adapter.
    if (name === 'arrange') {
      const write = (id: string, pose: unknown) => env.setPose(asNodeId(id), pose as TPose);
      return env.tolerant(createArrangeOp(args as ArrangeArgs, undefined, write));
    }
    if (name === CARRY_OP) {
      const { op, poses } = args as CarryArgs<TPose>;
      const inner = rebuild(op.name, op.args);
      return inner === null ? null : carried.rebuilt(inner, poses);
    }
    const rebuilt = rebuildGlobalOp(name, args);
    return rebuilt === null ? null : bindOpToHistoryAdapter(rebuilt, () => historyAdapter);
  }

  return {
    rebuild,
    apply(engine, ops, label, adapter) {
      const journal = activeJournal?.() ?? null;
      env.driving(() => {
        // Either engine stores the ops and replays them later, so they are
        // rebound to this call's adapter: the scene's own engine, and any
        // journal opened on it, was built without one.
        const bound = ops.map((op) => carried.recording(env.tolerant(bindOpToAdapter(op, adapter))));
        if (journal) journal.applyBatch(bound, label);
        else engine.applyOps(bound, label);
      });
    },
    wrote: carried.wrote,
    carry(id, pose) {
      if (carried.carries()) env.setPose(id, pose);
    },
    setHistoryAdapter(fn) {
      historyAdapter = fn;
    },
    setActiveJournalAccessor(fn) {
      activeJournal = fn;
    },
  };
}
