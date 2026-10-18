import type { ModeMachine } from './machine';

/**
 * Put the machine in `modeId` on `targetId`, from whatever it is in. Already
 * there changes nothing; a soft mode on something else is left for the new
 * one; a strict mode keeps its transaction.
 */
export function enterModeOn(machine: ModeMachine, modeId: string, targetId: string): void {
  const current = machine.registry.current();
  if (current.id !== 'normal') {
    // `enterMode` throws while a mode is active.
    if (machine.getActiveTargetId() === targetId || current.kind !== 'soft') return;
    machine.exitMode();
  }
  machine.enterMode(modeId, { targetId });
}
