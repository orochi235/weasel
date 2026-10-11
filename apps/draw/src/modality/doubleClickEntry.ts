import type { ModeMachine } from './machine';

export interface HitLike {
  kind: string;
  id: string;
}

export function dispatchDoubleClickEntry(
  hit: HitLike | null,
  machine: ModeMachine,
): void {
  if (!hit) return;
  const modeId = MODE_OF_KIND[hit.kind];
  if (modeId === undefined) return;
  const current = machine.registry.current();
  if (current.id !== 'normal') {
    // `enterMode` throws while a mode is active. A second double-click on the
    // mode's own target changes nothing; one on another node leaves a soft
    // mode for the new one, and a strict mode keeps the click.
    if (machine.getActiveTargetId() === hit.id || current.kind !== 'soft') return;
    machine.exitMode();
  }
  machine.enterMode(modeId, { targetId: hit.id });
}

const MODE_OF_KIND: Record<string, string | undefined> = {
  path: 'path-edit',
  group: 'isolation',
  text: 'text-edit',
};
