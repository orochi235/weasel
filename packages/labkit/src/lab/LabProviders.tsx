import { type ReactNode, useMemo } from 'react';
import { useStore } from 'zustand/react';
import { LabStoreProvider } from '../state/context';
import type { LabStore } from '../state/store';
import { type LabCommands, LabCommandsContext, LabContext } from './LabContext';

/** Props for `LabProviders`. */
export interface LabProvidersProps {
  store: LabStore;
  commands: LabCommands;
  children: ReactNode;
}

/**
 * A lab's store and its two contexts. `LabContext` carries `trials`, so its
 * value is new whenever any trial's record changes; `LabCommandsContext` is
 * the same value without them, for a reader that must not re-render then.
 * This is the lab's one subscriber to the trials' records.
 */
export function LabProviders({ store, commands, children }: LabProvidersProps) {
  const trials = useStore(store, (s) => s.trials);
  const lab = useMemo(() => ({ ...commands, trials }), [commands, trials]);
  return (
    <LabStoreProvider store={store}>
      <LabCommandsContext.Provider value={commands}>
        <LabContext.Provider value={lab}>{children}</LabContext.Provider>
      </LabCommandsContext.Provider>
    </LabStoreProvider>
  );
}
