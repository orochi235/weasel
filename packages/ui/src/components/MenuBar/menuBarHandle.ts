import { createContext } from 'react';

/** The modifiers held with a title's access letter to open its menu while focus is in the bar. */
export interface MenuAccessChord {
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** What the bar's key layer drives it through. */
export interface MenuBarHandle {
  /** Focus the title that last had focus, else the first. */
  focus(): void;
  /** Open a title's menu, as from the keyboard. A disabled title opens nothing. */
  open(key: string): void;
  /** Whether focus is on one of the bar's titles. */
  hasFocus(): boolean;
}

/** The enclosing bar's handle, for the key layer drawn inside it. */
export const MenuBarHandleContext = createContext<MenuBarHandle | null>(null);
