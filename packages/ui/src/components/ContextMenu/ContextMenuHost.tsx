import { useCallback, useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createMenuController, type Rect } from '@weasel-js/menu';
import { useMenuHost, type OpenMenu } from '@weasel-js/core';
import { useOverlayPortal } from '../../overlays/portalHost';
import { MenuPanel } from './MenuPanel';
import { useDismiss } from './useDismiss';

const noop = () => () => {};
const nothing = () => null;

/** Draws the menu the nearest `<ActionsProvider>`'s host has open. Mount one per app. */
export function ContextMenuHost() {
  const host = useMenuHost();
  const open = useSyncExternalStore(host?.subscribe ?? noop, host?.current ?? nothing, host?.current ?? nothing);
  const { anchor, portalProps, ready } = useOverlayPortal();
  const target = portalProps.UNSTABLE_portalContainer ?? (typeof document !== 'undefined' ? document.body : null);
  return (
    <>
      {anchor}
      {open && ready && target && host && createPortal(<OpenPanels key={open.seq} open={open} close={host.close} />, target)}
    </>
  );
}

function OpenPanels({ open, close }: { open: OpenMenu; close: () => void }) {
  const idBase = useId();
  const returnTo = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const panels = useRef(new Map<number, HTMLElement>());
  const controller = useMemo(() => createMenuController({
    entries: open.entries, highlightFirst: open.source === 'keyboard', onClose: close,
  }), [open, close]);
  useEffect(() => () => {
    controller.dispose();
    (returnTo.current as HTMLElement | null)?.focus?.();
  }, [controller]);
  const stack = useSyncExternalStore(controller.subscribe, controller.stack, controller.stack);
  const isInside = useCallback(
    (t: EventTarget | null) => t instanceof Node && [...panels.current.values()].some((el) => el.contains(t)),
    [],
  );
  useDismiss(isInside, close);

  const rowRect = (level: number): Rect | null => {
    const at = stack[level];
    const el = at == null ? null : document.getElementById(`${idBase}-${level}-${at}`);
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
          anchor={level === 0 ? open.client : null}
          parentRow={() => (level === 0 ? null : rowRect(level - 1))}
          focus={level === stack.length - 1}
          register={(el) => { if (el) panels.current.set(level, el); else panels.current.delete(level); }}
        />
      ))}
    </>
  );
}
