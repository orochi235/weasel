import { useMemo } from 'react';
import { useStore } from 'zustand/react';
import type { LabStore } from '../state/store';

/** The sidebar sections trial `trialId` has torn out into the workspace, and the writes that tear one
 *  out and put it back. */
export function useTrialPanels(store: LabStore, trialId: string) {
  const undock = useStore(store, (s) => s.undockPanel);
  const dock = useStore(store, (s) => s.dockPanel);
  const undockedPanels = useStore(store, (s) => s.undockedPanels);
  const undocked = useMemo(
    () =>
      Object.values(undockedPanels)
        .filter((p) => p.trialId === trialId)
        .map((p) => p.sectionId),
    [undockedPanels, trialId],
  );
  return useMemo(
    () => ({
      undocked,
      undockPanel: (sectionId: string, as?: 'tile' | 'floating') => undock(trialId, sectionId, as),
      dockPanel: (sectionId: string) => dock(trialId, sectionId),
    }),
    [undocked, undock, dock, trialId],
  );
}
