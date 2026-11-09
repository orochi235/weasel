/**
 * Whether node `id` already holds what an op is about to write, read through
 * the adapter's `getNode` where it has one. An op reports that as a no-op, so
 * history records no entry for a write that changed nothing: a scene adapter's
 * write records nothing then, and an op that caused no kit op is otherwise
 * kept as one that wrote outside the scene.
 */
export function alreadyHolds(adapter: unknown, id: string, holds: (node: Record<string, unknown>) => boolean): boolean {
  const getNode = (adapter as { getNode?: (id: string) => unknown } | null | undefined)?.getNode;
  if (typeof getNode !== 'function') return false;
  const node = getNode.call(adapter, id);
  return typeof node === 'object' && node !== null && holds(node as Record<string, unknown>);
}
