import type { NodeId, OperandsDep } from '@weasel-js/core';

/**
 * Hand what a replacing edit left back to `operands`, where they are not the
 * selection the edit already updated: each operand now gone from the scene
 * gives way to the edit's results.
 */
export function handBackOperands(
  operands: OperandsDep | undefined,
  scene: { getNode(id: NodeId): unknown },
  result: { kind: string; resultIds?: readonly string[] },
): void {
  if (!operands || result.kind !== 'applied' || !result.resultIds) return;
  const now = operands.get();
  const kept = now.filter((id) => scene.getNode(id) != null);
  if (kept.length === now.length) return;
  operands.set([...kept, ...(result.resultIds as NodeId[]).filter((id) => !kept.includes(id))]);
}
