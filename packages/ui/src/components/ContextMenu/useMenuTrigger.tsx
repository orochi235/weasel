import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useLatest, type OpenMenu } from '@weasel-js/core';
import type { MenuEntry } from '@weasel-js/menu';
import { useOverlayPortal } from '../../overlays/portalHost';
import { OpenPanels } from './ContextMenuHost';

/** What {@link useMenuTrigger} hands back. */
export interface MenuTrigger {
  /** Goes on the `<button>` that opens the menu. */
  button: RefObject<HTMLButtonElement | null>;
  /** The menu is open. */
  open: boolean;
  /** Open `entries` under the button. With `silent` the panel takes focus only once focus is already inside it.
   *  Returns false, opening nothing, for an empty list. */
  show: (entries: ReadonlyArray<MenuEntry>, source: OpenMenu['source'], silent?: boolean) => boolean;
  close: () => void;
  /** The button's `onClick`: opens `build()`, unless the press behind this click closed the menu, which stays closed.
   *  A click with no pointer under it came from the keyboard, which highlights the first row. */
  click: (e: MouseEvent, build: () => ReadonlyArray<MenuEntry>) => void;
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
  const isOpen = useLatest(open !== null);
  // The menu's dismiss listener has closed it by the time the button's click runs, so a window listener
  // registered before that one reads whether the press found it open.
  const wasOpen = useRef(false);
  useEffect(() => {
    const press = (e: PointerEvent) => {
      if (e.target instanceof Node && button.current?.contains(e.target)) wasOpen.current = isOpen.current;
    };
    window.addEventListener('pointerdown', press, true);
    return () => window.removeEventListener('pointerdown', press, true);
  }, [isOpen]);
  const { anchor, container, ready } = useOverlayPortal(portalContainer);
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);

  const close = useCallback(() => {
    setOpen(null);
    if (!quietNow.current || document.activeElement?.closest('[role="menu"]')) button.current?.focus();
  }, []);

  const show = useCallback((entries: ReadonlyArray<MenuEntry>, source: OpenMenu['source'], silent = false): boolean => {
    if (entries.length === 0) return false;
    const rect = button.current!.getBoundingClientRect();
    const under = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    setOpen((prev) => ({ seq: (prev?.seq ?? 0) + 1, entries, client: { x: rect.left, y: rect.bottom }, under, source }));
    quietNow.current = silent;
    setQuiet(silent);
    return true;
  }, []);

  const click = useCallback((e: MouseEvent, build: () => ReadonlyArray<MenuEntry>) => {
    if (wasOpen.current) {
      wasOpen.current = false;
      return;
    }
    show(build(), e.detail === 0 ? 'keyboard' : 'pointer');
  }, [show]);

  const portal = open && ready && target
    ? createPortal(<OpenPanels key={open.seq} open={open} close={close} takeFocus={!quiet} />, target)
    : null;
  return { button, open: open !== null, show, close, click, anchor, portal };
}
