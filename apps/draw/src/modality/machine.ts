import { createModeRegistry, modeLabel, type ModeRegistry } from '@weasel-js/modes';
import type { ModeDefinition } from '@weasel-js/modes';
import type { History, Journal } from '@weasel-js/history';

export interface CreateModeMachineOptions {
  modes: readonly ModeDefinition[];
  history: History;
  initial?: string;
  /** Whether a soft mode keeps its edits in a journal of its own, which undo steps while the mode
   *  is open and which lands on `history` as one entry when it closes. Read on entry. Without
   *  one, each edit is an entry on `history`. Defaults to true. */
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
  exitMode(): void;       // soft modes: leave, keeping the session's edits
  commitMode(): void;     // strict modes: commit
  cancelMode(): void;     // strict modes: cancel
  discardMode(): void;    // soft modes: take back the session's edits
  /** Leave whatever mode is open, keeping its work: a soft mode exits, a strict one commits. */
  leaveMode(): void;
}

export function createModeMachine(opts: CreateModeMachineOptions): ModeMachine {
  const { history } = opts;
  const registry = createModeRegistry({
    modes: opts.modes,
    initial: opts.initial ?? 'normal',
  });

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
      firstEntryId = history.currentEntryId();
    } else {
      activeJournal = history.beginJournal({ targetId: tid ?? undefined, label: def.id });
    }
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

  /** Close the mode, its journal's edits landing on `history` as one entry. */
  function close(): void {
    activeJournal?.commit(modeLabel(registry.current()));
    reset();
  }

  /** Undo every entry pushed on `history` since the mode began. */
  function undoSinceEntry(): void {
    let depth = history.undoDepth();
    while (depth > 0 && history.entries().undo[depth - 1]!.id >= firstEntryId) {
      history.undo();
      const after = history.undoDepth();
      if (after >= depth) break;
      depth = after;
    }
  }

  const isSoft = (): boolean => active && registry.current().kind === 'soft';

  return {
    registry,
    getActiveJournal: () => activeJournal,
    getActiveTargetId: () => activeTargetId,
    enterMode,
    exitMode() {
      if (isSoft()) close();
    },
    commitMode() {
      if (active && registry.current().kind === 'strict') close();
    },
    cancelMode() {
      if (!activeJournal || registry.current().kind !== 'strict') return;
      activeJournal.cancel();
      reset();
    },
    leaveMode() {
      if (active) close();
    },
    discardMode() {
      if (!isSoft()) return;
      if (activeJournal) activeJournal.cancel();
      else undoSinceEntry();
      reset();
    },
  };
}
