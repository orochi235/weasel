import {
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '@weasel-js/core';
import { createContext, type ReactNode, useContext } from 'react';

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;
const NO_ELEMENT = { current: null };

/** True under a `<LabActions>`. */
export const LabActionsContext = createContext(false);

/** Whether a lab-wide actions registry is already in scope. */
export function useInLabActions(): boolean {
  return useContext(LabActionsContext);
}

/**
 * The lab's one actions registry, and the dispatcher that hears its keys. It
 * runs only what is registered on the lab's own node, and runs it first; a key
 * bound in a scope below it fires through that scope's own canvas alone.
 */
export function LabActions({ children }: { children: ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <LabKeys />
          <LabActionsContext.Provider value={true}>{children}</LabActionsContext.Provider>
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function LabKeys() {
  const actions = useActionsRegistry() as ActionsRegistry;
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions,
    entriesById: NO_TOOLS,
    channels: CHANNELS,
    keyboard: 'first',
    hears: 'own',
  });
  return null;
}
