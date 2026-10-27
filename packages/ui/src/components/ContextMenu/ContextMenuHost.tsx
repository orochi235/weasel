import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createMenuController, withLinks, type MenuController, type Rect } from '@weasel-js/menu';
import { useMenuHost, type MenuHost, type OpenMenu } from '@weasel-js/core';
import { MenuPanel } from './MenuPanel';
import { useDismiss } from './useDismiss';
import { useMenuPortal } from './useMenuPortal';
import { MenuPartsContext } from './menuParts';

const noop = () => () => {};
const nothing = () => null;

/** Draws the menu the nearest `<ActionsProvider>`'s host has open. Mount one per app. */
export function ContextMenuHost() {
  const host = useMenuHost();
  const open = useSyncExternalStore(host?.subscribe ?? noop, host?.current ?? nothing, host?.current ?? nothing);
  useReturnFocus(host);
  const { anchor, target } = useMenuPortal();
  return (
    <>
      {anchor}
      {open && target && host && createPortal(<OpenPanels key={open.seq} open={open} close={host.close} />, target)}
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
 *  With `takeFocus` false a panel takes focus only once focus is already inside the menu.
 *  `labelledBy` names the element that labels the first panel,
 *  `inside` names extra targets that do not dismiss, `onEdge` hears Left or Right with nothing to open or close,
 *  and while `releaseRuns` is true a pointerup over a row presses it, until the first pointerup anywhere. */
export function OpenPanels({ open, close, takeFocus = true, labelledBy, inside, onEdge, releaseRuns = false }: {
  open: OpenMenu; close: () => void; takeFocus?: boolean; labelledBy?: string;
  inside?: (target: EventTarget | null) => boolean;
  onEdge?: (dir: -1 | 1) => void;
  releaseRuns?: boolean;
}) {
  const [controller, setController] = useState<MenuController | null>(null);
  const edge = useRef(onEdge);
  const release = useRef(releaseRuns);
  useLayoutEffect(() => { edge.current = onEdge; });
  // `open` is a dependency so a new menu arms again while the prop stays true.
  useLayoutEffect(() => { release.current = releaseRuns; }, [releaseRuns, open]);
  useEffect(() => {
    const disarm = () => { release.current = false; };
    window.addEventListener('pointerup', disarm);
    window.addEventListener('pointercancel', disarm);
    return () => {
      window.removeEventListener('pointerup', disarm);
      window.removeEventListener('pointercancel', disarm);
    };
  }, []);
  // Built where it is disposed, so StrictMode's rerun of this effect gets a live one.
  useLayoutEffect(() => {
    const c = createMenuController({
      entries: withLinks(open.entries, (href) => window.location.assign(href)),
      highlightFirst: open.source === 'keyboard',
      onClose: close,
      onEdge: (dir) => edge.current?.(dir),
    });
    setController(c);
    return () => c.dispose();
  }, [open, close]);
  return controller
    ? <Panels controller={controller} open={open} close={close} takeFocus={takeFocus} labelledBy={labelledBy} inside={inside} release={release} />
    : null;
}

function Panels({ controller, open, close, takeFocus, labelledBy, inside, release }: {
  controller: MenuController; open: OpenMenu; close: () => void; takeFocus: boolean; labelledBy: string | undefined;
  inside: ((target: EventTarget | null) => boolean) | undefined;
  release: { readonly current: boolean };
}) {
  const idBase = useId();
  const panels = useRef(new Map<number, HTMLElement>());
  const parts = useRef(new Map<string, HTMLElement>());
  const registerPart = useCallback((key: string, el: HTMLElement | null) => {
    if (el) parts.current.set(key, el); else parts.current.delete(key);
  }, []);
  const stack = useSyncExternalStore(controller.subscribe, controller.stack, controller.stack);
  const isInside = useCallback(
    (t: EventTarget | null) =>
      (t instanceof Node && [...panels.current.values(), ...parts.current.values()].some((el) => el.contains(t)))
      || inside?.(t) === true,
    [inside],
  );
  useDismiss(isInside, close);

  const root = useMemo(() => (open.under ? { client: open.client, under: open.under, ...(open.side ? { side: open.side } : {}) } : { client: open.client }), [open]);
  const focusable = takeFocus || (typeof document !== 'undefined' && document.activeElement?.id.startsWith(`${idBase}-panel-`) === true);
  const rowId = (level: number) => `${idBase}-${level}-${stack[level]}`;
  const rowRect = (level: number): Rect | null => {
    const el = stack[level] == null ? null : document.getElementById(rowId(level));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  return (
    <MenuPartsContext.Provider value={registerPart}>
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
          labelledBy={level === 0 ? labelledBy : rowId(level - 1)}
          anchor={level === 0 ? root : null}
          parentRow={() => (level === 0 ? null : rowRect(level - 1))}
          focus={focusable && level === stack.length - 1}
          releaseRuns={release}
          close={close}
          register={(el) => { if (el) panels.current.set(level, el); else panels.current.delete(level); }}
        />
      ))}
    </MenuPartsContext.Provider>
  );
}
