import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createMenuController, type MenuController, type Rect } from '@weasel-js/menu';
import { useMenuHost, type MenuHost, type OpenMenu } from '@weasel-js/core';
import { useOverlayPortal } from '../../overlays/portalHost';
import { MenuPanel } from './MenuPanel';
import { useDismiss } from './useDismiss';

const noop = () => () => {};
const nothing = () => null;

/** Draws the menu the nearest `<ActionsProvider>`'s host has open. Mount one per app. */
export function ContextMenuHost() {
  const host = useMenuHost();
  const open = useSyncExternalStore(host?.subscribe ?? noop, host?.current ?? nothing, host?.current ?? nothing);
  useReturnFocus(host);
  const { anchor, container, ready } = useOverlayPortal();
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);
  return (
    <>
      {anchor}
      {open && ready && target && host && createPortal(<OpenPanels key={open.seq} open={open} close={host.close} />, target)}
    </>
  );
}

/** Remember what had focus when a menu opens from none, and give it back when the last one closes.
 *  Reads the host as it changes, before any panel renders and takes focus. */
function useReturnFocus(host: MenuHost | null): void {
  useEffect(() => {
    if (!host) return;
    let returnTo: Element | null = null;
    let wasOpen = host.current() !== null;
    return host.subscribe(() => {
      const isOpen = host.current() !== null;
      if (isOpen && !wasOpen) returnTo = document.activeElement;
      if (!isOpen && wasOpen) {
        const el = returnTo as HTMLElement | null;
        returnTo = null;
        if (el?.isConnected) el.focus?.();
      }
      wasOpen = isOpen;
    });
  }, [host]);
}

/** One open menu's panels, with the controller that runs them. What the host draws, and a bar's menu button.
 *  With `takeFocus` false a panel takes focus only once focus is already inside the menu. */
export function OpenPanels({ open, close, takeFocus = true }: { open: OpenMenu; close: () => void; takeFocus?: boolean }) {
  const [controller, setController] = useState<MenuController | null>(null);
  // Built where it is disposed, so StrictMode's rerun of this effect gets a live one.
  useLayoutEffect(() => {
    const c = createMenuController({ entries: open.entries, highlightFirst: open.source === 'keyboard', onClose: close });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- publishes the controller this effect creates
    setController(c);
    return () => c.dispose();
  }, [open, close]);
  return controller ? <Panels controller={controller} open={open} close={close} takeFocus={takeFocus} /> : null;
}

function Panels({ controller, open, close, takeFocus }: { controller: MenuController; open: OpenMenu; close: () => void; takeFocus: boolean }) {
  const idBase = useId();
  const panels = useRef(new Map<number, HTMLElement>());
  const stack = useSyncExternalStore(controller.subscribe, controller.stack, controller.stack);
  const isInside = useCallback(
    (t: EventTarget | null) => t instanceof Node && [...panels.current.values()].some((el) => el.contains(t)),
    [],
  );
  useDismiss(isInside, close);

  const root = useMemo(() => (open.under ? { client: open.client, under: open.under } : { client: open.client }), [open]);
  const focusable = takeFocus || (typeof document !== 'undefined' && document.activeElement?.id.startsWith(`${idBase}-panel-`) === true);
  const rowId = (level: number) => `${idBase}-${level}-${stack[level]}`;
  const rowRect = (level: number): Rect | null => {
    const el = stack[level] == null ? null : document.getElementById(rowId(level));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  return (
    <>
      {stack.map((highlight, level) => (
        <MenuPanel
          // A submenu panel remounts, and so re-places itself, when the row it hangs from changes.
          key={level === 0 ? 'root' : `${level}:${stack[level - 1]}`}
          controller={controller}
          level={level}
          entries={controller.entriesAt(level)}
          highlight={highlight}
          childOpen={stack.length > level + 1}
          idBase={idBase}
          labelledBy={level === 0 ? undefined : rowId(level - 1)}
          anchor={level === 0 ? root : null}
          parentRow={() => (level === 0 ? null : rowRect(level - 1))}
          focus={focusable && level === stack.length - 1}
          register={(el) => { if (el) panels.current.set(level, el); else panels.current.delete(level); }}
        />
      ))}
    </>
  );
}
