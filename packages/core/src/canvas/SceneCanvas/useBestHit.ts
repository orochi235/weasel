import { useMemo } from 'react';
import { createBestHitPicker, type BestHit } from '../bestHitPicker';
import type { PickView } from './useScenePickers';
import type { WorldPoint } from '@weasel-js/routing';

export type BestHitPicker = (world: WorldPoint, view?: PickView | null) => BestHit | null;

/**
 * The node under a world point with its routing kind, resolved through the
 * select tool's own single-hit picker, so `onClick`, `onDoubleClick`, hover,
 * and tool routing all name the node a click selects.
 */
export function useBestHit<TData>(args: {
  pickBest: ((world: WorldPoint, view?: PickView | null) => string | null) | undefined;
  /** A caller's `geometry.pickEvery` can answer an id the scene does not hold. */
  nodes: { getNode(id: string): { kind: string; data: TData } | null | undefined };
  kindOf: ((node: { kind: string; data: TData }) => string) | undefined;
}): BestHitPicker | undefined {
  const { pickBest, nodes, kindOf } = args;
  return useMemo(() => {
    if (!pickBest) return undefined;
    return createBestHitPicker(pickBest, (id) => {
      const node = nodes.getNode(id);
      if (!node) return null;
      return { kind: kindOf ? kindOf(node) : 'unknown' };
    });
  }, [nodes, pickBest, kindOf]);
}
