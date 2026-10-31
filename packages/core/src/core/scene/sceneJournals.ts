/**
 * The journals opened on `scene.history`: each wrapped so its applies and
 * undos re-enter scene mutation the way the facade's do, and tracked while
 * open, so the scene's edits go to the innermost.
 */
import type { BeginJournalOptions, Journal } from '@weasel-js/history';
import type { SceneHistoryEnv } from './historyFacade';

interface OpenJournals {
  wrap(raw: Journal): Journal;
  close(wrapped: Journal): void;
}

/** A journal drives adapter mutation itself, so its applies and undos
 *  re-enter scene mutation methods the way the facade's do. */
function wrapJournal(raw: Journal, env: SceneHistoryEnv, open: OpenJournals): Journal {
  const { replay, notify } = env;
  const wrapped: Journal = {
    targetId: raw.targetId,
    forkedAtEntryId: raw.forkedAtEntryId,
    applyBatch(ops, label) {
      env.labeled(label, () => env.runArrivalEdit(ops, (all) => {
        env.applying(() => raw.applyBatch(all.map(env.causing), label));
        notify();
      }));
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
    beginJournal: (opts) => open.wrap(raw.beginJournal(opts)),
    getVersion: () => raw.getVersion(),
    subscribe: (listener) => raw.subscribe(listener),
    commit(label) {
      // Flushes the session's net ops to the parent stack — no apply, but
      // the parent's undo depth changes and listeners read that.
      raw.commit(label);
      open.close(wrapped);
      notify();
    },
    cancel() {
      replay(() => raw.cancel());
      open.close(wrapped);
      notify();
    },
    suspend: () => raw.suspend(),
    isActive: () => raw.isActive(),
  };
  return wrapped;
}

export interface SceneJournals {
  /** Open a journal inside the one edits go to now, else on the engine: an
   *  edit session started during a mode's lands in the mode's as one entry. */
  begin(opts: BeginJournalOptions): Journal;
  resume(journal: Journal): void;
  /** The innermost active journal opened here, or null. */
  innermost(): Journal | null;
}

export function createSceneJournals(env: SceneHistoryEnv): SceneJournals {
  /** Wrapped journal → the engine's own: the engine keys resumability off
   *  journal identity, which a wrapper would not match. */
  const raws = new WeakMap<Journal, Journal>();
  const opened: Journal[] = [];
  const open: OpenJournals = {
    wrap(raw) {
      const wrapped = wrapJournal(raw, env, open);
      raws.set(wrapped, raw);
      opened.push(wrapped);
      return wrapped;
    },
    close(wrapped) {
      const i = opened.indexOf(wrapped);
      if (i >= 0) opened.splice(i, 1);
    },
  };
  return {
    begin(opts) {
      const parent = env.activeJournal();
      return open.wrap(parent ? (raws.get(parent) ?? parent).beginJournal(opts) : env.engine.beginJournal(opts));
    },
    resume: (journal) => env.engine.resumeJournal(raws.get(journal) ?? journal),
    innermost() {
      for (let i = opened.length - 1; i >= 0; i--) if (opened[i]!.isActive()) return opened[i]!;
      return null;
    },
  };
}
