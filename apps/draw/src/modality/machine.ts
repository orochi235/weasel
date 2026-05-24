import { createModeRegistry, type ModeRegistry } from '@orochi235/weasel-modes';
import type { ModeDefinition } from '@orochi235/weasel-modes';
import type { History, Journal } from '@orochi235/weasel-history';
import { createJournalCache, type JournalCache } from './journalCache';

export interface CreateModeMachineOptions {
  modes: readonly ModeDefinition[];
  history: History;
  initial?: string;
  cacheCapacity?: number;  // default 8
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
  getActiveJournal(): Journal | null;
  getActiveTargetId(): string | null;
  enterMode(id: string, args: EnterModeArgs): void;
  exitMode(): void;       // soft modes: suspend
  commitMode(): void;     // strict modes: commit
  cancelMode(): void;     // strict modes: cancel
  discardMode(): void;    // soft modes: cancel (no resume)
  clearJournalCache(): void;
}

export function createModeMachine(opts: CreateModeMachineOptions): ModeMachine {
  const registry = createModeRegistry({
    modes: opts.modes,
    initial: opts.initial ?? 'normal',
  });

  const cache: JournalCache = createJournalCache({ capacity: opts.cacheCapacity ?? 8 });

  let activeJournal: Journal | null = null;
  let activeTargetId: string | null = null;

  function enterMode(id: string, args: EnterModeArgs): void {
    if (id === 'normal') return;
    if (activeJournal !== null) {
      throw new Error(
        `Cannot enter mode "${id}" while mode "${registry.current().id}" is active`,
      );
    }
    const def = registry.byId(id);
    const tid = args.targetId ?? null;

    // Soft mode + targetId → consult cache
    if (def.kind === 'soft' && tid !== null) {
      const cached = cache.get(id, tid);
      if (cached) {
        opts.history.resumeJournal(cached);
        activeJournal = cached;
        activeTargetId = tid;
        registry.setMode(id);
        return;
      }
    }

    activeJournal = opts.history.beginJournal({
      targetId: tid ?? undefined,
      label: def.id,
    });
    activeTargetId = tid;
    registry.setMode(id);
  }

  function reset(): void {
    activeJournal = null;
    activeTargetId = null;
    registry.setMode('normal');
  }

  function exitMode(): void {
    if (!activeJournal) return;
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
    if (!activeJournal) return;
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
