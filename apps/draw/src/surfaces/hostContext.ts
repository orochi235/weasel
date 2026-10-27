import { createContext, useContext } from 'react';
import type { SidebarHost } from './types';

/** The editor state assets read on whichever surface draws them. */
export const SurfaceHostContext = createContext<SidebarHost | null>(null);

/** The editor state an asset's leaves read. Throws outside the editor: such a leaf has nothing to show. */
export function useSurfaceHost(): SidebarHost {
  const host = useContext(SurfaceHostContext);
  if (!host) throw new Error('useSurfaceHost: no SurfaceHostContext above this surface');
  return host;
}
