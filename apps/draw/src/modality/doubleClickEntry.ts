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
  switch (hit.kind) {
    case 'path':
      machine.enterMode('path-edit', { targetId: hit.id });
      return;
    case 'group':
      machine.enterMode('isolation', { targetId: hit.id });
      return;
    case 'text':
      machine.enterMode('text-edit', { targetId: hit.id });
      return;
    default:
      return;
  }
}
