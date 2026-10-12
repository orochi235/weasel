import { type ReactNode, useMemo } from 'react';
import { LabStoreProvider } from '../state/context';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { type LabCommands, LabCommandsContext, LabContext } from './LabContext';

/** Props for `LabProviders`. */
export interface LabProvidersProps {
  store: LabStore;
  commands: LabCommands;
  trials: TrialRecord[];
  children: ReactNode;
}

/**
 * A lab's store and its two contexts. `LabContext` carries `trials`, so its
 * value is new whenever any trial's record changes; `LabCommandsContext` is
 * the same value without them, for a reader that must not re-render then.
 */
export function LabProviders({ store, commands, trials, children }: LabProvidersProps) {
  const lab = useMemo(() => ({ ...commands, trials }), [commands, trials]);
  return (
    <LabStoreProvider store={store}>
      <LabCommandsContext.Provider value={commands}>
        <LabContext.Provider value={lab}>{children}</LabContext.Provider>
      </LabCommandsContext.Provider>
    </LabStoreProvider>
  );
}
