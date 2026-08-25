import { createContext, useContext } from 'react';
import type { NodeId } from 'windease';

/** Supplied by `<Workspace>` when trials are reorderable, so a trial's title
 *  bar can be the drag surface. Null when reordering is off. */
export const TrialDragContext = createContext<{ nodeId: NodeId } | null>(null);

export function useTrialDrag(): { nodeId: NodeId } | null {
  return useContext(TrialDragContext);
}
