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
import type { Scene } from './types';

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
}

/** The scene's own spellings of its history, which answer what a caller
 *  outside the engine's vocabulary asks: whether a step moved anything. */
export type SceneHistoryMethods = Pick<
  Scene<unknown, string, unknown>,
  | 'undo' | 'redo' | 'canUndo' | 'canRedo' | 'historyEntries' | 'historyIndex'
  | 'jumpToHistoryIndex' | 'serializeHistory' | 'restoreHistory'
>;

/** A journal drives adapter mutation itself, so its applies and undos
 *  re-enter scene mutation methods the way the facade's do. */
function wrapJournal(raw: Journal, env: SceneHistoryEnv): Journal {
  const { replay, notify } = env;
  return {
    targetId: raw.targetId,
    forkedAtEntryId: raw.forkedAtEntryId,
    applyBatch(ops, label) {
      env.runArrivalEdit(ops, (all) => {
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
}

export function createSceneHistory(env: SceneHistoryEnv): { history: History; methods: SceneHistoryMethods } {
  const { engine, replay, notify, refuseUntracked, runArrivalEdit } = env;

  /** Wrapped journal → the engine's own, for `resumeJournal`: the engine keys
   *  resumability off journal identity, which a wrapper would not match. */
  const rawJournals = new WeakMap<Journal, Journal>();

  function step(can: () => boolean, run: () => void): boolean {
    if (!can()) return false;
    replay(run);
    notify();
    return true;
  }

  const methods: SceneHistoryMethods = {
    undo: () => step(() => engine.canUndo(), () => engine.undo()),
    redo: () => step(() => engine.canRedo(), () => engine.redo()),
    canUndo: () => engine.canUndo(),
    canRedo: () => engine.canRedo(),
    historyEntries() {
      const { undo, redo } = engine.entries();
      // entries().redo is already chronological: the next redo comes first.
      return [...undo, ...redo].map((e) => ({ id: String(e.id), label: e.label }));
    },
    historyIndex: () => engine.undoDepth(),
    jumpToHistoryIndex(index) {
      const total = engine.undoDepth() + engine.redoDepth();
      const target = Math.max(0, Math.min(total, index));
      return step(() => target !== engine.undoDepth(), () => engine.goto(target));
    },
    serializeHistory: () => engine.serialize(),
    restoreHistory(snapshot) {
      // Only the stacks are rebuilt: no op applies.
      engine.restore(snapshot);
      notify();
    },
  };

  const history: History = {
    // Mutating: applied ops re-enter the scene's own mutation methods.
    apply(op, label) {
      refuseUntracked('history.apply');
      runArrivalEdit([op], (all) => {
        const run = () => (all.length === 1
          ? engine.apply(env.tolerant(op), label)
          : engine.applyOps(all.map(env.tolerant), label ?? op.label ?? ''));
        env.applying(run);
        notify();
      });
    },
    applyOps(ops, label) {
      refuseUntracked('history.applyOps');
      runArrivalEdit(ops, (all) => {
        env.applying(() => engine.applyOps(all.map(env.tolerant), label));
        notify();
      });
    },
    undo: () => { methods.undo(); },
    redo: () => { methods.redo(); },
    goto: (n) => { methods.jumpToHistoryIndex(n); },
    // Stack-only: nothing applies, but what `canUndo()` answers changes.
    clear() {
      engine.clear();
      notify();
    },
    recordEntry(ops, label, opts) {
      engine.recordEntry(ops, label, opts);
      notify();
    },
    prune(t) {
      engine.prune(t);
      notify();
    },
    switchBranch(id) {
      engine.switchBranch(id);
      notify();
    },
    restore: methods.restoreHistory,
    // Reads forward to the engine, `version` included: it counts history
    // operations, where the scene's counts every mutation.
    canUndo: methods.canUndo,
    canRedo: methods.canRedo,
    undoDepth: () => engine.undoDepth(),
    redoDepth: () => engine.redoDepth(),
    entries: () => engine.entries(),
    timestampAt: (i) => engine.timestampAt(i),
    depthAt: (t) => engine.depthAt(t),
    branches: () => engine.branches(),
    getVersion: () => engine.getVersion(),
    subscribe: (listener) => engine.subscribe(listener),
    serialize: methods.serializeHistory,
    allForwardOps: () => engine.allForwardOps(),
    seal: () => engine.seal(),
    currentEntryId: () => engine.currentEntryId(),
    beginJournal(opts) {
      const raw = engine.beginJournal(opts);
      const wrapped = wrapJournal(raw, env);
      rawJournals.set(wrapped, raw);
      return wrapped;
    },
    resumeJournal: (journal) => engine.resumeJournal(rawJournals.get(journal) ?? journal),
  };
  return { history, methods };
}
