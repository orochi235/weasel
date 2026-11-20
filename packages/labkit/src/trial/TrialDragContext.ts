import { createContext, useContext } from 'react';
import type { NodeId } from 'windease';

/** Supplied by `<Workspace>` to each trial tile, so a trial's title bar can be
 *  the drag surface while `reorderable` is on. Null outside a workspace. */
export interface TrialDrag {
  nodeId: NodeId;
  reorderable: boolean;
}

export const TrialDragContext = createContext<TrialDrag | null>(null);

export function useTrialDrag(): TrialDrag | null {
  return useContext(TrialDragContext);
}
