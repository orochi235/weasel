import { sceneMutators } from '../scene/sceneMutators';
import type { NodeId, Scene } from '../scene/types';
import type { Op } from './types';

/** A node's pose and data, as a batch of ops leaves them. */
export interface WrittenNode {
  pose: unknown;
  data: unknown;
}

/**
 * The pose and data `ops` leave each node they write, by id, read by applying
 * them to a recorder rather than the scene; null when one cannot be read that
 * way. A node only re-parented, re-layered, inserted, or removed is not in it.
 */
export function writtenBy(sc: Scene<unknown, string, unknown>, ops: readonly Op[]): Map<string, WrittenNode> | null {
  const after = new Map<string, WrittenNode>();
  const current = (id: string): WrittenNode | null => {
    const node = after.get(id) ?? sc.get(id as NodeId);
    return node ? { pose: node.pose, data: node.data } : null;
  };
  const write = (id: string, field: keyof WrittenNode, value: unknown) => {
    const node = current(id);
    if (node) after.set(id, { ...node, [field]: value });
  };
  const reads = sceneMutators(sc);
  const noop = () => {};
  const recorder = {
    ...reads,
    setPose: (id: string, pose: unknown) => write(id, 'pose', pose),
    setData: (id: string, data: unknown) => write(id, 'data', data),
    setParent: noop, setChildOrder: noop, setLayer: noop, setDependsOn: noop, setLayout: noop,
    setHidden: noop, setLocked: noop, removeNode: noop, insertNode: noop,
    getSelection: (): string[] => [...sc.getSelection()],
    setSelection: noop,
  };
  try {
    for (const op of ops) op.apply(recorder);
  } catch {
    return null;
  }
  return after;
}
