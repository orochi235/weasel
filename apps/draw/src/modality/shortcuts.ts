import { modeShortcuts, type Contribution } from '@weasel-js/core';
import type { ModeMachine } from './machine';

/** What entering a mode from the keyboard needs from the app. */
export interface ModeEntry {
  /** The path the selection offers to edit, or null when it offers none. */
  pathToEdit(): string | null;
  /** The ids selected now. */
  selection(): readonly string[];
}

/** What a mode entered by key acts on. `undefined` means it cannot be entered
 *  now; `null` means it is entered with no target. */
function entryTarget(id: string, entry: ModeEntry): string | null | undefined {
  if (id === 'path-edit') return entry.pathToEdit() ?? undefined;
  if (id === 'free-transform') {
    const ids = entry.selection();
    if (ids.length === 0) return undefined;
    return ids.length === 1 ? ids[0] : null;
  }
  // Crop changes the page, so it takes nothing from the selection.
  if (id === 'crop') return null;
  return undefined;
}

/**
 * The machine's mode keys as canvas bindings: every leave-a-mode key, and,
 * given `entry`, each entry key the modes declare. An entry key works from
 * normal mode only: the machine holds one mode at a time.
 */
export function modalityShortcuts(machine: ModeMachine, entry?: ModeEntry): Contribution {
  const target = (id: string): string | null | undefined =>
    entry && machine.registry.current().id === 'normal' ? entryTarget(id, entry) : undefined;
  return modeShortcuts(machine.registry, {
    ...(entry ? {
      canEnter: (id: string) => target(id) !== undefined,
      enter: (id: string) => {
        const targetId = target(id);
        if (targetId !== undefined) machine.enterMode(id, { targetId });
      },
    } : {}),
    exit: () => machine.exitMode(),
    discard: () => machine.discardMode(),
    commit: () => machine.commitMode(),
    cancel: () => machine.cancelMode(),
  });
}
