import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useLatest, type OpenMenu } from '@weasel-js/core';
import type { MenuEntry } from '@weasel-js/menu';
import { OpenPanels } from './ContextMenuHost';
import { menuUnder } from './menuUnder';
import { useMenuPortal } from './useMenuPortal';

/** What {@link useMenuTrigger} hands back. */
export interface MenuTrigger {
  /** Goes on the `<button>` that opens the menu. */
  button: RefObject<HTMLButtonElement | null>;
  /** Goes on the button too: it names the menu. */
  id: string;
  /** The menu is open. */
  open: boolean;
  /** Open `entries` under the button. With `silent` the panel takes focus only once focus is already inside it.
   *  With `above` it opens over the button when it fits there. Returns false, opening nothing, for an empty list. */
  show: (entries: ReadonlyArray<MenuEntry>, source: OpenMenu['source'], silent?: boolean, above?: boolean) => boolean;
  close: () => void;
  /** The button's `onPointerDown`: a press on the open button closes the menu. */
  press: (e: PointerEvent) => void;
  /** The button's `onClick`: opens `build()`, unless the press behind this click closed the menu, which stays closed.
   *  A click with no pointer under it came from the keyboard, which highlights the first row. */
  click: (e: MouseEvent, build: () => ReadonlyArray<MenuEntry>, above?: boolean) => void;
  /** A hidden marker the portal host is found from; render it beside the button. */
  anchor: ReactElement;
  /** The open menu's panels, in a portal; render it beside the button. */
  portal: ReactNode;
}

/** The opening logic of a button that opens a DOM menu: placement under the button, a press on the open button
 *  closing it for good, and focus coming back to the button when it closes. */
export function useMenuTrigger(portalContainer?: Element | null): MenuTrigger {
  const [open, setOpen] = useState<OpenMenu | null>(null);
  // Opened silently: it takes focus only once the reader moves focus into it.
  const [quiet, setQuiet] = useState(false);
  const quietNow = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const seq = useRef(0);
  // The press on the open button that closed the menu: the click it leads to must not reopen it.
  const closedByPress = useRef(false);
  const { anchor, target } = useMenuPortal(portalContainer);

  const close = useCallback(() => {
    setOpen(null);
    if (!quietNow.current || inMenuOf(document.activeElement, id)) button.current?.focus();
  }, [id]);

  const show = useCallback((entries: ReadonlyArray<MenuEntry>, source: OpenMenu['source'], silent = false, above = false): boolean => {
    if (entries.length === 0) return false;
    setOpen(menuUnder(button.current!, entries, source, ++seq.current, above));
    quietNow.current = silent;
    setQuiet(silent);
    return true;
  }, []);

  const inside = useCallback((t: EventTarget | null) => t instanceof Node && button.current?.contains(t) === true, []);
  const isOpen = useLatest(open !== null);

  // A press that lands elsewhere will not click the button, so it cancels what an earlier one left.
  useEffect(() => {
    const away = (e: globalThis.PointerEvent) => { if (!inside(e.target)) closedByPress.current = false; };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [inside]);

  const press = useCallback(() => {
    closedByPress.current = isOpen.current;
    if (isOpen.current) close();
  }, [isOpen, close]);

  const click = useCallback((e: MouseEvent, build: () => ReadonlyArray<MenuEntry>, above = false) => {
    const swallow = closedByPress.current && e.detail !== 0;
    closedByPress.current = false;
    if (!swallow) show(build(), e.detail === 0 ? 'keyboard' : 'pointer', false, above);
  }, [show]);

  const portal = open && target
    ? createPortal(<OpenPanels key={open.seq} open={open} close={close} takeFocus={!quiet} labelledBy={id} inside={inside} />, target)
    : null;
  return { button, id, open: open !== null, show, close, press, click, anchor, portal };
}

/** Whether `el` is inside the menu `labelId` names, directly or through the rows its submenus hang from. */
function inMenuOf(el: Element | null, labelId: string): boolean {
  const doc = el?.ownerDocument;
  let menu = el?.closest('[role="menu"]') ?? null;
  while (menu) {
    const by = menu.getAttribute('aria-labelledby');
    if (by === labelId) return true;
    const parent = (by ? doc?.getElementById(by) : null)?.closest('[role="menu"]') ?? null;
    menu = parent === menu ? null : parent;
  }
  return false;
}
