import type { MenuDef } from '@weasel-js/core';
import { type ReactNode, useMemo } from 'react';
import { useStore } from 'zustand/react';
import { type LabOver, LabOverContext, useKeptOver } from '../config/over';
import { LabStoreProvider } from '../state/context';
import type { LabStore } from '../state/store';
import { LabActions } from './LabActions';
import { type LabCommands, LabCommandsContext, LabContext } from './LabContext';

/** Props for `LabProviders`. */
export interface LabProvidersProps {
  store: LabStore;
  commands: LabCommands;
  contextMenus?: readonly MenuDef[];
  /** The app's values for the schemas configs are drawn over; omitted, kept here. */
  over?: LabOver;
  children: ReactNode;
}

/**
 * A lab's store, its two contexts, and its actions registry. `LabContext`
 * carries `trials`, so its value is new whenever any trial's record changes;
 * `LabCommandsContext` is the same value without them, for a reader that must
 * not re-render then.
 * This is the lab's one subscriber to the trials' records.
 */
export function LabProviders({
  store,
  commands,
  contextMenus,
  over,
  children,
}: LabProvidersProps) {
  const trials = useStore(store, (s) => s.trials);
  const lab = useMemo(() => ({ ...commands, trials }), [commands, trials]);
  const kept = useKeptOver(over);
  return (
    <LabStoreProvider store={store}>
      <LabOverContext.Provider value={kept}>
      <LabCommandsContext.Provider value={commands}>
        <LabContext.Provider value={lab}>
          <LabActions contextMenus={contextMenus}>{children}</LabActions>
        </LabContext.Provider>
      </LabCommandsContext.Provider>
      </LabOverContext.Provider>
    </LabStoreProvider>
  );
}
