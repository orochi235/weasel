import { modeShortcuts, type Contribution } from '@weasel-js/core';
import { IMPLICIT_TAGS } from '@weasel-js/modes';
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

/** The active mode as `<SceneCanvas getActiveMode>` reads it. */
export function activeModeOf(machine: ModeMachine): { id: string; allowedCapabilities: ReadonlySet<string> } {
  const mode = machine.registry.current();
  return { id: mode.id, allowedCapabilities: new Set<string>([...mode.allows, ...IMPLICIT_TAGS]) };
}
