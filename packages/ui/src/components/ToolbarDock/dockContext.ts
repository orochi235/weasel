import { createContext, useContext, type HTMLAttributes } from 'react';

/** What a dock tells the bar it draws: which bar it is, what it is called, and whether it may be moved. */
export interface DockBarContextValue {
  barId: string;
  label: string;
  movable: boolean;
}

export const DockBarContext = createContext<DockBarContextValue | null>(null);

/** A movable bar's handle: the bar it moves, and the attributes and handlers its lead spreads. */
export interface DockHandle {
  barId: string;
  props: HTMLAttributes<HTMLElement>;
}

const KEYS = 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown';

/** The handle for the bar a movable `ToolbarDock` is drawing, else `null`. */
export function useDockHandle(): DockHandle | null {
  const bar = useContext(DockBarContext);
  if (!bar?.movable) return null;
  return {
    barId: bar.barId,
    props: { role: 'button', tabIndex: 0, 'aria-label': `Move ${bar.label} toolbar`, 'aria-keyshortcuts': KEYS },
  };
}
