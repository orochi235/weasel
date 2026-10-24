/** The nodes the current mode leaves lit and reachable: the one node it is on, or none. */
export function modeScopeIds(machine: { getActiveTargetId(): string | null }): ReadonlySet<string> {
  const target = machine.getActiveTargetId();
  return new Set(target ? [target] : []);
}
