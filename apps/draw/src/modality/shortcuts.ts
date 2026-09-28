import { modeShortcuts, type Contribution } from '@weasel-js/core';
import type { ModeMachine } from './machine';

/**
 * The machine's leave-a-mode keys as canvas bindings. No `enter`: WeaselDraw
 * enters modes by double-click only.
 */
export function modalityShortcuts(machine: ModeMachine): Contribution {
  return modeShortcuts(machine.registry, {
    exit: () => machine.exitMode(),
    discard: () => machine.discardMode(),
    commit: () => machine.commitMode(),
    cancel: () => machine.cancelMode(),
  });
}

