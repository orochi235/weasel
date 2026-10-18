import { asNodeId, type Scene } from '@weasel-js/core';
import type { ModeMachine } from './machine';

const ISOLATION = 'isolation';

/** The group isolation is in, or null in any other mode. */
export function isolatedGroupOf(machine: ModeMachine): string | null {
  return machine.registry.current().id === ISOLATION ? machine.getActiveTargetId() : null;
}

/**
 * The nodes the current mode leaves lit and reachable: the isolated group and everything inside
 * it, or the one node another mode is on.
 */
export function modeScopeIds(machine: ModeMachine, scene: Pick<Scene<unknown, string, unknown>, 'childrenOf'>): ReadonlySet<string> {
  const target = machine.getActiveTargetId();
  const ids = new Set<string>();
  if (!target) return ids;
  ids.add(target);
  if (isolatedGroupOf(machine) !== target) return ids;
  const stack = [target];
  while (stack.length > 0) {
    for (const child of scene.childrenOf(asNodeId(stack.pop()!))) {
      ids.add(child);
      stack.push(child);
    }
  }
  return ids;
}
