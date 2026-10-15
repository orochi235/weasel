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

/**
 * `canvasOpens` says whether the canvas has anchors to open on a node. A path it can open is
 * entered by the canvas's own `enterPathEdit` binding, so it is left alone here; one it cannot,
 * such as a rect, still takes path-edit, as Enter does.
 */
export function dispatchDoubleClickEntry(
  hit: HitLike | null,
  machine: ModeMachine,
  canvasOpens: (id: string) => boolean = () => true,
): void {
  if (!hit) return;
  if (hit.kind === 'path') {
    if (!canvasOpens(hit.id)) enterModeOn(machine, 'path-edit', hit.id);
    return;
  }
  const modeId = MODE_OF_KIND[hit.kind];
  if (modeId !== undefined) enterModeOn(machine, modeId, hit.id);
}

// Text is not here: its mode follows the edit, which `useTextEditSession` enters it from.
const MODE_OF_KIND: Record<string, string | undefined> = {
  group: 'isolation',
};
