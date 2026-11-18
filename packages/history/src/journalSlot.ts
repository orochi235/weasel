/**
 * The one journal a history may have open at a time: opening it, resuming a
 * suspended one, and refusing stack moves while one is open.
 */
import {
  createJournalInternal, _resumeJournalInternal, _resumedByOwnerInternal, _refuseWhileActiveInternal as refuseWhileActive,
  type BeginJournalOptions, type Journal,
} from './journal';
import type { CreateHistoryOptions, History } from './historyTypes';

/** The options a journal's inner history inherits from its parent's. */
export type InheritedOptions = Pick<CreateHistoryOptions, 'coalesceWindowMs' | 'now' | 'debug' | 'selection'>;

export function createJournalSlot(adapter: unknown, inherited: InheritedOptions) {
  let active: Journal | null = null;
  return {
    /** Throws while a journal is open. */
    refuse(): void {
      refuseWhileActive(active);
    },
    begin(history: History, opts: BeginJournalOptions): Journal {
      refuseWhileActive(active);
      const j = createJournalInternal(history, adapter, opts, () => { active = null; }, inherited);
      active = j;
      return j;
    },
    active: () => (active?.isActive() ? active : null),
    resume(history: History, journal: Journal): void {
      if (_resumedByOwnerInternal(journal, history)) return;
      refuseWhileActive(active, journal);
      _resumeJournalInternal(journal);
      active = journal;
    },
  };
}
