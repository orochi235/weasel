import { createContext, useContext } from 'react';

/** Registers an element an open menu counts as its own, so a press inside it does not dismiss the menu: a popover
 *  a row opens, which portals outside every panel. Called with null when it goes. */
type RegisterPart = (key: string, el: HTMLElement | null) => void;

export const MenuPartsContext = createContext<RegisterPart | null>(null);

/** The open menu's {@link RegisterPart}, or a no-op outside one. */
export function useMenuPart(): RegisterPart {
  return useContext(MenuPartsContext) ?? noop;
}

const noop: RegisterPart = () => {};
