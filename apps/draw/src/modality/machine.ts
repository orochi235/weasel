import { createModeRegistry, type ModeRegistry } from '@weasel-js/modes';
import type { ModeDefinition } from '@weasel-js/modes';
import type { History, Journal } from '@weasel-js/history';
import { createJournalCache, type JournalCache } from './journalCache';

export interface CreateModeMachineOptions {
  modes: readonly ModeDefinition[];
  history: History;
  initial?: string;
  cacheCapacity?: number;  // default 8
  /** Whether a soft mode keeps its edits in a journal of its own, which undo steps while the mode
   *  is open. Read on entry. Without one, each edit is an entry on `history`. Defaults to true. */
  journalSoftModes?: () => boolean;
}

export interface EnterModeArgs {
  /** The scene id this mode is scoped to. Required for modes whose
   *  `scoping` is true; allowed for strict modes (free-transform takes
   *  the current selection's id). For non-scoping non-targeted modes,
   *  pass `null`. */
  targetId?: string | null;
}

export interface ModeMachine {
  readonly registry: ModeRegistry;
  /** The open mode's journal, or null — also null in a soft mode that records to `history`. */
  getActiveJournal(): Journal | null;
  getActiveTargetId(): string | null;
  enterMode(id: string, args: EnterModeArgs): void;
  exitMode(): void;       // soft modes: suspend
  commitMode(): void;     // strict modes: commit
  cancelMode(): void;     // strict modes: cancel
  discardMode(): void;    // soft modes: take back the session's edits (no resume)
  clearJournalCache(): void;
}

export function createModeMachine(opts: CreateModeMachineOptions): ModeMachine {
  const registry = createModeRegistry({
    modes: opts.modes,
    initial: opts.initial ?? 'normal',
  });

  const cache: JournalCache = createJournalCache({ capacity: opts.cacheCapacity ?? 8 });

  let active = false;
  let activeJournal: Journal | null = null;
  let activeTargetId: string | null = null;
  /** In a soft mode with no journal: the id its first entry on `history` gets. */
  let firstEntryId = 0;

  function enterMode(id: string, args: EnterModeArgs): void {
    if (id === 'normal') return;
    if (active) {
      throw new Error(
        `Cannot enter mode "${id}" while mode "${registry.current().id}" is active`,
      );
    }
    const def = registry.byId(id);
    const tid = args.targetId ?? null;

    if (def.kind === 'soft' && opts.journalSoftModes?.() === false) {
      firstEntryId = opts.history.currentEntryId();
      active = true;
      activeTargetId = tid;
      registry.setMode(id);
      return;
    }

    // Soft mode + targetId → consult cache
    if (def.kind === 'soft' && tid !== null) {
      const cached = cache.get(id, tid);
      if (cached) {
        // Staleness check: discard if any parent-history entry since the
        // fork point touched the journal's target node.
        const forkId = cached.forkedAtEntryId;
        const since = opts.history.entries().undo.filter((e) => e.id >= forkId);
        const stale = since.some((e) => e.touchedIds?.has(tid));
        if (stale) {
          cache.remove(id, tid);
          // fall through to begin a fresh journal below
        } else {
          opts.history.resumeJournal(cached);
          active = true;
          activeJournal = cached;
          activeTargetId = tid;
          registry.setMode(id);
          return;
        }
      }
    }

    activeJournal = opts.history.beginJournal({
      targetId: tid ?? undefined,
      label: def.id,
    });
    active = true;
    activeTargetId = tid;
    registry.setMode(id);
  }

  function reset(): void {
    active = false;
    activeJournal = null;
    activeTargetId = null;
    registry.setMode('normal');
  }

  function exitMode(): void {
    if (!active) return;
    if (!activeJournal) return reset();
    const def = registry.current();
    activeJournal.suspend();
    if (def.kind === 'soft' && activeTargetId !== null) {
      cache.put(def.id, activeTargetId, activeJournal);
    }
    reset();
  }

  function commitMode(): void {
    if (!activeJournal) return;
    const def = registry.current();
    activeJournal.commit(def.id);
    reset();
  }

  function cancelMode(): void {
    if (!activeJournal) return;
    activeJournal.cancel();
    reset();
  }

  function discardMode(): void {
    if (!active) return;
    if (!activeJournal) {
      let depth = opts.history.undoDepth();
      while (depth > 0 && opts.history.entries().undo[depth - 1]!.id >= firstEntryId) {
        opts.history.undo();
        const after = opts.history.undoDepth();
        if (after >= depth) break;
        depth = after;
      }
      return reset();
    }
    const def = registry.current();
    activeJournal.cancel();
    if (activeTargetId !== null) cache.remove(def.id, activeTargetId);
    reset();
  }

  return {
    registry,
    getActiveJournal: () => activeJournal,
    getActiveTargetId: () => activeTargetId,
    enterMode,
    exitMode,
    commitMode,
    cancelMode,
    discardMode,
    clearJournalCache: () => cache.clear(),
  };
}
