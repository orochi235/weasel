import { modeShortcuts, type Contribution } from '@weasel-js/core';
import type { ModeMachine } from './machine';

/** What entering path-edit from the keyboard needs from the app. */
export interface PathEditEntry {
  /** The path the selection offers to edit, or null when it offers none. */
  pathToEdit(): string | null;
  /** Make that path's anchors editable on the canvas. */
  startPathEdit(): void;
}

/**
 * The machine's mode keys as canvas bindings: every leave-a-mode key, and,
 * given `entry`, path-edit's entry key on a selected path. The other modes are
 * entered by double-click only.
 */
export function modalityShortcuts(machine: ModeMachine, entry?: PathEditEntry): Contribution {
  return modeShortcuts(machine.registry, {
    ...(entry ? {
      canEnter: (id: string) => id === 'path-edit' && entry.pathToEdit() !== null,
      enter: (id: string) => {
        const targetId = entry.pathToEdit();
        if (id !== 'path-edit' || targetId === null) return;
        // The order a double-click takes: the canvas first, then the mode.
        entry.startPathEdit();
        machine.enterMode(id, { targetId });
      },
    } : {}),
    exit: () => machine.exitMode(),
    discard: () => machine.discardMode(),
    commit: () => machine.commitMode(),
    cancel: () => machine.cancelMode(),
  });
}
