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
import { dwarn } from 'debug/flag';
import { SCENE_HISTORY_FORM, type SerializedSceneHistory } from './historyForm';
import { createSceneJournals } from './sceneJournals';
import type { Scene } from './types';

/** What the facade needs from the scene it fronts. */
export interface SceneHistoryEnv {
  /** The scene's own undo/redo engine. */
  engine: History;
  /** Run a step that applies ops through an engine: all-or-nothing, with
   *  scene-side recording suppressed. */
  applying(step: () => void): void;
  /** An op as the engine applies it: its entry records the kit ops it
   *  caused. */
  causing(op: Op): Op;
  /** Run a step that replays recorded ops: an undo, a redo, a cancel. */
  replay(step: () => void): void;
  notify(): void;
  refuseUntracked(verb: string): void;
  /** Run an op-driven edit with its arrivals settled into the same batch. */
  runArrivalEdit(ops: Op[], run: (ops: Op[]) => void): void;
  /** Run an edit applying ops, labeled `label` for the pose writes it reports. */
  labeled<T>(label: string, fn: () => T): T;
  /** The journal `applyBatch` writes to now, or null. Undo and redo step it
   *  instead of the engine, so they take back the edits that went there. */
  activeJournal(): Journal | null;
}

/** The scene's own spellings of its history, which answer what a caller
 *  outside the engine's vocabulary asks: whether a step moved anything. */
export type SceneHistoryMethods = Pick<
  Scene<unknown, string, unknown>,
  | 'undo' | 'redo' | 'canUndo' | 'canRedo' | 'historyEntries' | 'historyIndex'
  | 'jumpToHistoryIndex' | 'serializeHistory' | 'restoreHistory'
>;

export function createSceneHistory(env: SceneHistoryEnv): {
  history: History;
  methods: SceneHistoryMethods;
  /** The innermost active journal opened through `history`, or null. */
  openJournal(): Journal | null;
} {
  const { engine, replay, notify, refuseUntracked, runArrivalEdit } = env;

  const journals = createSceneJournals(env);

  function step(can: () => boolean, run: () => void): boolean {
    if (!can()) return false;
    replay(run);
    notify();
    return true;
  }

  /** What undo and redo step: the open journal, else the engine. */
  const stack = (): Pick<History, 'canUndo' | 'canRedo' | 'undo' | 'redo'> => env.activeJournal() ?? engine;

  const methods: SceneHistoryMethods = {
    undo() {
      const j = env.activeJournal();
      if (j) { if (!j.canUndo()) return false; j.undo(); return true; }
      return step(() => engine.canUndo(), () => engine.undo());
    },
    redo() {
      const j = env.activeJournal();
      if (j) { if (!j.canRedo()) return false; j.redo(); return true; }
      return step(() => engine.canRedo(), () => engine.redo());
    },
    canUndo: () => stack().canUndo(),
    canRedo: () => stack().canRedo(),
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
    serializeHistory: () => ({ ...engine.serialize(), form: SCENE_HISTORY_FORM }),
    restoreHistory(snapshot) {
      if ((snapshot as Partial<SerializedSceneHistory>).form !== SCENE_HISTORY_FORM) {
        dwarn('scene', 'restoreHistory: snapshot is not in the current recorded form — dropped');
        return;
      }
      // Only the stacks are rebuilt: no op applies.
      engine.restore(snapshot);
      notify();
    },
  };

  const history: History = {
    // Mutating: applied ops re-enter the scene's own mutation methods.
    apply(op, label) {
      refuseUntracked('history.apply');
      env.labeled(label ?? op.label ?? '', () => runArrivalEdit([op], (all) => {
        const run = () => (all.length === 1
          ? engine.apply(env.causing(op), label)
          : engine.applyOps(all.map(env.causing), label ?? op.label ?? ''));
        env.applying(run);
        notify();
      }));
    },
    applyOps(ops, label) {
      refuseUntracked('history.applyOps');
      env.labeled(label, () => runArrivalEdit(ops, (all) => {
        env.applying(() => engine.applyOps(all.map(env.causing), label));
        notify();
      }));
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
    observe: (listener) => engine.observe(listener),
    serialize: methods.serializeHistory,
    allForwardOps: () => engine.allForwardOps(),
    seal: () => engine.seal(),
    currentEntryId: () => engine.currentEntryId(),
    beginJournal: journals.begin,
    resumeJournal: journals.resume,
  };
  return { history, methods, openJournal: journals.innermost };
}
