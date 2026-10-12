/**
 * `scene.history`: the `History` the kit's `undo`/`redo` actions resolve
 * their `history` dep to, and the handle a mode machine opens journals
 * against.
 *
 * Handing out the engine directly would let an action-driven undo replay ops
 * with scene-side recording still armed and without bumping the scene's
 * version, so every member that mutates routes through the scene's own
 * wrappers and one `notify()`; reads forward to the engine.
 */
import type { History, Journal } from '@weasel-js/history';
import type { Op } from 'core/ops/types';

/** What the facade needs from the scene it fronts. */
export interface SceneHistoryEnv {
  /** The scene's own undo/redo engine. */
  engine: History;
  /** Run a step that applies ops through an engine: all-or-nothing, with
   *  scene-side recording suppressed. */
  applying(step: () => void): void;
  /** An op as the stack should hold it: one whose replay skips a node an
   *  untracked edit took. */
  tolerant(op: Op): Op;
  /** Run a step that replays recorded ops: an undo, a redo, a cancel. */
  replay(step: () => void): void;
  notify(): void;
  refuseUntracked(verb: string): void;
  /** Run an op-driven edit with its arrivals settled into the same batch. */
  runArrivalEdit(ops: Op[], run: (ops: Op[]) => void): void;
  undo: History['undo'];
  redo: History['redo'];
  goto: History['goto'];
  restore: History['restore'];
}

export function createSceneHistory(env: SceneHistoryEnv): History {
  const { engine: history, replay, notify, refuseUntracked, runArrivalEdit } = env;

  /** Wrapped journal → the engine's own, for `resumeJournal`: the engine keys
   *  resumability off journal identity, which a wrapper would not match. */
  const rawJournals = new WeakMap<Journal, Journal>();

  /** Same treatment as the façade: a journal drives adapter mutation itself,
   *  so its applies/undos re-enter scene mutation methods. */
  function wrapJournal(raw: Journal): Journal {
    const wrapped: Journal = {
      targetId: raw.targetId,
      forkedAtEntryId: raw.forkedAtEntryId,
      applyBatch(ops, label) {
        runArrivalEdit(ops, (all) => {
          env.applying(() => raw.applyBatch(all.map(env.tolerant), label));
          notify();
        });
      },
      undo() {
        replay(() => raw.undo());
        notify();
      },
      redo() {
        replay(() => raw.redo());
        notify();
      },
      canUndo: () => raw.canUndo(),
      canRedo: () => raw.canRedo(),
      entries: () => raw.entries(),
      seal: () => raw.seal(),
      getVersion: () => raw.getVersion(),
      subscribe: (listener) => raw.subscribe(listener),
      commit(label) {
        // Flushes the session's net ops to the parent stack — no apply, but
        // the parent's undo depth changes and listeners read that.
        raw.commit(label);
        notify();
      },
      cancel() {
        replay(() => raw.cancel());
        notify();
      },
      suspend: () => raw.suspend(),
      isActive: () => raw.isActive(),
    };
    rawJournals.set(wrapped, raw);
    return wrapped;
  }

  return {
    // Mutating: applied ops re-enter the scene's own mutation methods.
    apply(op, label) {
      refuseUntracked('history.apply');
      runArrivalEdit([op], (all) => {
        const run = () => (all.length === 1
          ? history.apply(env.tolerant(op), label)
          : history.applyOps(all.map(env.tolerant), label ?? op.label ?? ''));
        env.applying(run);
        notify();
      });
    },
    applyOps(ops, label) {
      refuseUntracked('history.applyOps');
      runArrivalEdit(ops, (all) => {
        env.applying(() => history.applyOps(all.map(env.tolerant), label));
        notify();
      });
    },
    undo: env.undo,
    redo: env.redo,
    goto: env.goto,
    // Stack-only: nothing applies, but what `canUndo()` answers changes.
    clear() {
      history.clear();
      notify();
    },
    recordEntry(ops, label, opts) {
      history.recordEntry(ops, label, opts);
      notify();
    },
    prune(t) {
      history.prune(t);
      notify();
    },
    switchBranch(id) {
      history.switchBranch(id);
      notify();
    },
    restore: env.restore,
    // Reads forward to the engine, `version` included: it counts history
    // operations, where the scene's counts every mutation.
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    undoDepth: () => history.undoDepth(),
    redoDepth: () => history.redoDepth(),
    entries: () => history.entries(),
    timestampAt: (i) => history.timestampAt(i),
    depthAt: (t) => history.depthAt(t),
    branches: () => history.branches(),
    getVersion: () => history.getVersion(),
    subscribe: (listener) => history.subscribe(listener),
    serialize: () => history.serialize(),
    allForwardOps: () => history.allForwardOps(),
    seal: () => history.seal(),
    currentEntryId: () => history.currentEntryId(),
    beginJournal: (opts) => wrapJournal(history.beginJournal(opts)),
    resumeJournal: (journal) => history.resumeJournal(rawJournals.get(journal) ?? journal),
  };
}
