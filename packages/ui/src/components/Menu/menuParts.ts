import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { Emitter } from '@weasel-js/registry';

/** Registers an element an open menu counts as its own, so a press inside it does not dismiss the menu: a popover
 *  a row opens, which portals outside every panel. Called with null when it goes. */
type RegisterPart = (key: string, el: HTMLElement | null) => void;

/** The attribute a part carries naming the row it hangs from, which the DOM cannot say for a part that portals. */
export const MENU_PART_OF = 'data-weasel-menu-part-of';

export const MenuPartsContext = createContext<RegisterPart | null>(null);

/** The open menu's {@link RegisterPart}, or a no-op outside one. */
export function useMenuPart(): RegisterPart {
  return useContext(MenuPartsContext) ?? noop;
}

const noop: RegisterPart = () => {};

/** The drafts of an open menu's fields, each committed when the menu goes: a removed field fires no blur React hears. */
export const MenuDraftsContext = createContext<Emitter | null>(null);

/** Have the open menu call `flush` as it closes, while its controller still takes a write. */
export function useMenuDraft(flush: () => void): void {
  const drafts = useContext(MenuDraftsContext);
  const latest = useRef(flush);
  useLayoutEffect(() => { latest.current = flush; });
  useLayoutEffect(() => {
    return drafts?.subscribe(() => latest.current());
  }, [drafts]);
}
