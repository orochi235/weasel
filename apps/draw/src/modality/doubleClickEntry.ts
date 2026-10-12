import type { ModeMachine } from './machine';

export interface HitLike {
  kind: string;
  id: string;
}

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

export function dispatchDoubleClickEntry(
  hit: HitLike | null,
  machine: ModeMachine,
): void {
  if (!hit) return;
  const modeId = MODE_OF_KIND[hit.kind];
  if (modeId !== undefined) enterModeOn(machine, modeId, hit.id);
}

const MODE_OF_KIND: Record<string, string | undefined> = {
  path: 'path-edit',
  group: 'isolation',
  text: 'text-edit',
};
