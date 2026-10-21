import {
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  type MenuDef,
  useActionsRegistry,
  useGestureDispatcher,
  useMenuHost,
  useMenus,
} from '@weasel-js/core';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { createContext, type ReactNode, useContext } from 'react';
import { LabAmbientContext, useLabAmbientHost } from './labAmbient';
import { LabContextMenusContext } from './labContextMenus';

const CHANNELS = { contextMenu: false, ingest: false } as const;
const NO_ELEMENT = { current: null };
const NONE: readonly MenuDef[] = [];

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
export function LabActions({
  contextMenus,
  children,
}: {
  contextMenus?: readonly MenuDef[];
  children: ReactNode;
}) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <LabKeys>
            <LabContextMenus defs={contextMenus ?? NONE}>
              <LabActionsContext.Provider value={true}>{children}</LabActionsContext.Provider>
            </LabContextMenus>
          </LabKeys>
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

/** The lab's key dispatcher, over what `useLabAmbient` installs below it. */
function LabKeys({ children }: { children: ReactNode }) {
  const actions = useActionsRegistry() as ActionsRegistry;
  const { entriesById, host } = useLabAmbientHost();
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions,
    entriesById,
    channels: CHANNELS,
    // First, so a story's own zoom keys don't also fire over a trial with a camera;
    // over one without, the action is disabled and the keys pass on.
    keyboard: 'first',
    hears: 'own',
  });
  return <LabAmbientContext.Provider value={host}>{children}</LabAmbientContext.Provider>;
}

/** Declares the lab's context menus on its root's host and draws whichever one opens. */
function LabContextMenus({ defs, children }: { defs: readonly MenuDef[]; children: ReactNode }) {
  useMenus(defs);
  const host = useMenuHost();
  return (
    <LabContextMenusContext.Provider value={defs.length > 0 ? host : null}>
      {children}
      <ContextMenuHost />
    </LabContextMenusContext.Provider>
  );
}
