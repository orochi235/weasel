import type { ModeMachine } from './machine';

/**
 * Put the machine in `modeId` on `targetId`, from whatever it is in. Already
 * in `modeId` on `targetId` changes nothing; any other soft mode, on this
 * target or another, is left for the new one; a strict mode keeps its
 * transaction.
 */
export function enterModeOn(machine: ModeMachine, modeId: string, targetId: string): void {
  const current = machine.registry.current();
  if (current.id !== 'normal') {
    // `enterMode` throws while a mode is active.
    const already = current.id === modeId && machine.getActiveTargetId() === targetId;
    if (already || current.kind !== 'soft') return;
    machine.exitMode();
  }
  machine.enterMode(modeId, { targetId });
}
