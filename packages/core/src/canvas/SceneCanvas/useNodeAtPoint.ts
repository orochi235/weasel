import { useMemo } from 'react';
import { makeGetNodeAtPoint, type NodeAtPointHit } from '../getNodeAtPoint';
import type { PickView } from './useSceneSelectTool';

export type NodeAtPoint = (wx: number, wy: number, view?: PickView | null) => NodeAtPointHit | null;

/**
 * The node under a world point with its routing kind, resolved through the
 * select tool's own single-hit picker, so `onClick`, `onDoubleClick`, hover,
 * and tool routing all name the node a click selects.
 */
export function useNodeAtPoint<TData>(args: {
  pickBest: ((wx: number, wy: number, view?: PickView | null) => string | null) | undefined;
  /** A caller's `geometry.pickEvery` can answer an id the scene does not hold. */
  nodes: { getNode(id: string): { kind: string; data: TData } | null | undefined };
  kindOf: ((node: { kind: string; data: TData }) => string) | undefined;
}): NodeAtPoint | undefined {
  const { pickBest, nodes, kindOf } = args;
  return useMemo(() => {
    if (!pickBest) return undefined;
    return makeGetNodeAtPoint(pickBest, (id) => {
      const node = nodes.getNode(id);
      if (!node) return null;
      return { kind: kindOf ? kindOf(node) : 'unknown' };
    });
  }, [nodes, pickBest, kindOf]);
}
