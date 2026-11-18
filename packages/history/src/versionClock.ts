/**
 * A history's change counter: the version every mutation bumps, the
 * listeners told of each bump, and the anchor that keeps a coalesce window
 * open only until the next bump.
 */
import { createEmitter } from '@weasel-js/registry';
import type { HistoryStep } from './historyTypes';

export function createVersionClock() {
  let version = 0;
  /** `version` as of the last push or coalesce. A batch may only merge into
   *  the top entry while this still matches: every other operation bumps
   *  `version`, so undo, redo, goto, clear, restore and `recordEntry` all
   *  expire the merge window without having to remember to. Without that, an
   *  edit made after stepping back rewrites whatever entry the step left on
   *  top, and one undo then jumps past it. */
  let anchorVersion = -1;
  const changed = createEmitter();
  const stepped = createEmitter<[HistoryStep]>();
  return {
    current: () => version,
    /** Whether anything observes steps, so a caller can skip building one. */
    observed: () => stepped.size > 0,
    bump(step?: HistoryStep): void {
      version++;
      if (step && stepped.size > 0) stepped.emit(step);
      changed.emit();
    },
    /** Open the coalesce window at the current version. */
    anchor(): void {
      anchorVersion = version;
    },
    seal(): void {
      anchorVersion = -1;
    },
    anchored: () => version === anchorVersion,
    subscribe: changed.subscribe,
    observe: stepped.subscribe,
  };
}

export type VersionClock = ReturnType<typeof createVersionClock>;
