import { useLatest } from '@weasel-js/core';
import { useMemo } from 'react';
import type { ContainerEdit } from './regionSync';
import type { EdgeRoute, NodeMove } from './sceneSync';

/** Everything one gesture or layout run changed, as `DiagramView`'s `onEdit`
 *  reports it: what `onMove` and `onEditContainer` heard from it, together. */
export interface DiagramEdit {
  moves: readonly NodeMove[];
  routes: readonly EdgeRoute[];
  containers: readonly ContainerEdit[];
}

type OnMove = (moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => void;
type OnEditContainer = (edit: ContainerEdit) => void;

/** `onMove` and `onEditContainer` as the view calls them. With `onEdit` set,
 *  each also gathers its report, and the reports one task makes — a drag that
 *  carries a container's members and moves its box — go to `onEdit` as one
 *  edit once that task is done. */
export function useBatchedEdits(
  onMove: OnMove | undefined,
  onEditContainer: OnEditContainer | undefined,
  onEdit: ((edit: DiagramEdit) => void) | undefined,
): { onMove: OnMove | undefined; onEditContainer: OnEditContainer | undefined } {
  const latest = useLatest({ onMove, onEditContainer, onEdit });
  const batching = onEdit !== undefined;
  const wrapped = useMemo(() => {
    if (!batching) return null;
    let pending: { moves: NodeMove[]; routes: EdgeRoute[]; containers: ContainerEdit[] } | null = null;
    const gather = () => {
      if (pending !== null) return pending;
      const batch = { moves: [], routes: [], containers: [] };
      pending = batch;
      queueMicrotask(() => {
        pending = null;
        latest.current.onEdit?.(batch);
      });
      return batch;
    };
    return {
      onMove: (moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => {
        latest.current.onMove?.(moves, routes);
        const batch = gather();
        batch.moves.push(...moves);
        batch.routes.push(...routes);
      },
      onEditContainer: (edit: ContainerEdit) => {
        latest.current.onEditContainer?.(edit);
        gather().containers.push(edit);
      },
    };
  }, [batching, latest]);
  return wrapped ?? { onMove, onEditContainer };
}
