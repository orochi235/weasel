import { createContext } from 'react';

/** The modifiers held with a title's access letter to open its menu from anywhere in the app. */
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
}

/** The enclosing bar's handle, for the key layer drawn inside it. */
export const MenuBarHandleContext = createContext<MenuBarHandle | null>(null);
