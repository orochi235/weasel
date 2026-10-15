import { createContext, useContext, useEffect } from 'react';
import type { MenuHost } from './menuHost';
import type { MenuDef } from './types';

export const MenuHostContext = createContext<MenuHost | null>(null);

/** The menu host of the nearest `<ActionsProvider>`, or null outside one. */
export function useMenuHost(): MenuHost | null {
  return useContext(MenuHostContext);
}

/** Declare menus for the calling component's lifetime. Memoize `defs`. */
export function useMenus(defs: readonly MenuDef[], owner: string | null = null): void {
  const host = useMenuHost();
  useEffect(() => {
    if (!host) return;
    const releases = defs.map((d) => host.define(d, owner));
    return () => { for (const r of releases) r(); };
  }, [host, defs, owner]);
}
