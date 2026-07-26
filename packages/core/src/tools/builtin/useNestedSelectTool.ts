import { useMemo } from 'react';
import {
  nestedHitTester,
  type NestedHitOpts,
} from 'features/groups/nestedHit';
import {
  useSelectTool,
  type SelectAdapter,
  type UseSelectToolOptions,
} from './select';

/** Adapter contract: SelectAdapter (Move + AreaSelect) plus the lookups
 *  `nestedHitTester` needs (`getParent` + the existing `getNode`/`getNodes`/`getPose`). */
export type NestedSelectAdapter<TNode extends { id: string }, TPose> =
  SelectAdapter<TNode, TPose> & {
    getNode: (id: string) => TNode | undefined;
    getNodes: () => TNode[];
    getParent: (id: string) => string | null;
  };

export interface UseNestedSelectToolOptions<TNode extends { id: string }, TPose>
  extends NestedHitOpts<TNode, TPose>,
    Omit<UseSelectToolOptions<TNode, TPose>, 'pickBest'> {}

/**
 * Convenience over `useSelectTool` for scenes with nesting. Builds a
 * `nestedHitTester` from `composePose` + `isGroup` and wires its `pickBest`
 * into the select tool — alt-clicks drill outermost ancestor → child → leaf
 * automatically. Casual clicks select the outermost ancestor.
 *
 * Equivalent to writing:
 *
 * ```tsx
 * const hitter = useMemo(() => nestedHitTester(adapter, { composePose, isGroup }), [adapter]);
 * const select = useSelectTool(adapter, { pickBest: (...args) => hitter.pickBest(...args) });
 * ```
 *
 * but with one fewer concept on the consumer surface.
 */
export function useNestedSelectTool<TNode extends { id: string }, TPose>(
  adapter: NestedSelectAdapter<TNode, TPose>,
  options: UseNestedSelectToolOptions<TNode, TPose>,
): ReturnType<typeof useSelectTool<TNode, TPose>> {
  const { composePose, isGroup, poseBounds, ...selectOpts } = options;
  const hitter = useMemo(
    () => nestedHitTester(adapter, { composePose, isGroup, poseBounds }),
    [adapter, composePose, isGroup, poseBounds],
  );
  return useSelectTool<TNode, TPose>(adapter, {
    ...selectOpts,
    pickBest: (wx, wy, alt, sel) => hitter.pickBest(wx, wy, alt, sel),
  });
}
