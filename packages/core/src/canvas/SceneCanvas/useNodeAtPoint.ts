import { useMemo } from 'react';
import { makeGetNodeAtPoint, type NodeAtPointHit } from '../getNodeAtPoint';
import type { PickView } from './useSceneSelectTool';

export type NodeAtPoint = (wx: number, wy: number, view?: PickView | null) => NodeAtPointHit | null;

/**
 * The node under a world point with its routing kind, resolved through the
 * select tool's own single-hit picker, so `onClick`, `onDoubleClick`, hover,
 * and tool routing all name the node a click selects. A hit whose id
 * `isPointerInteractive` rejects comes back null.
 */
export function useNodeAtPoint<TData>(args: {
  pickBest: ((wx: number, wy: number, view?: PickView | null) => string | null) | undefined;
  /** A caller's `geometry.pickEvery` can answer an id the scene does not hold. */
  nodes: { getNode(id: string): { data: TData } | null | undefined };
  kindOfData: ((data: TData) => string) | undefined;
  isPointerInteractive: ((id: string) => boolean) | undefined;
}): NodeAtPoint | undefined {
  const { pickBest, nodes, kindOfData, isPointerInteractive } = args;
  return useMemo(() => {
    if (!pickBest) return undefined;
    const base = makeGetNodeAtPoint(pickBest, (id) => {
      const node = nodes.getNode(id);
      if (!node) return null;
      return { kind: kindOfData ? kindOfData(node.data) : 'unknown' };
    });
    if (!isPointerInteractive) return base;
    return (wx, wy, view) => {
      const hit = base(wx, wy, view);
      if (hit == null) return null;
      if (isPointerInteractive(hit.id) === false) return null;
      return hit;
    };
  }, [nodes, pickBest, isPointerInteractive, kindOfData]);
}
