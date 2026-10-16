import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  buildDepsFromRequires,
  resolveSchemaMenu,
  useLatest,
  useActionsRegistry,
  useOptionalDepRegistry,
  type OpenMenu,
} from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { useOverlayPortal } from '../../overlays/portalHost';
import { Caret } from '../Caret';
import { OpenPanels } from '../ContextMenu/ContextMenuHost';
import f from '../field.module.css';
import s from './Bar.module.css';

/** Where a bar's menu reads and writes the values its rows show: the bar's own. */
export interface BarMenuSources {
  values: (path: string) => unknown;
  onChange?: (path: string, value: unknown) => void;
  /** The schema an alias in the menu points into. */
  over?: PrefGroup;
}

/** Props for {@link BarMenu}. */
export interface BarMenuProps extends BarMenuSources {
  /** What the button reads, and what names the menu. */
  label: string;
  /** The menu, as a schema `resolveSchemaMenu` walks: resolved each time it opens, so it shows what holds then. */
  schema: PrefGroup;
}

/**
 * A bar's cell for a group drawn `as: 'menu'`: a button that opens the group
 * as the DOM menu the context menu host draws — actions as items, flags as
 * checked items, choices as radio rows, nested groups as submenus.
 */
export function BarMenu({ label, schema, values, onChange, over }: BarMenuProps) {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  const [open, setOpen] = useState<OpenMenu | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const isOpen = useLatest(open !== null);
  // A press on the button closes an open menu, and its click must not reopen it. The menu's dismiss listener has
  // closed it by the button's own handler, so a window listener registered before that one reads whether it was open.
  const wasOpen = useRef(false);
  useEffect(() => {
    const press = (e: PointerEvent) => {
      if (e.target instanceof Node && button.current?.contains(e.target)) wasOpen.current = isOpen.current;
    };
    window.addEventListener('pointerdown', press, true);
    return () => window.removeEventListener('pointerdown', press, true);
  }, [isOpen]);
  const { anchor, container, ready } = useOverlayPortal();
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);

  const close = useCallback(() => {
    setOpen(null);
    button.current?.focus();
  }, []);

  const show = (source: OpenMenu['source']): void => {
    const entries = resolveSchemaMenu(schema, {
      actions: () => registry?.list() ?? [],
      depsFor: (action) => (depReg ? buildDepsFromRequires(action, depReg) : undefined),
      trigger: (id, params) => registry?.trigger(id, params) ?? false,
      values,
      ...(onChange ? { onChange } : {}),
      ...(over ? { over } : {}),
    });
    if (entries.length === 0) return;
    const rect = button.current!.getBoundingClientRect();
    setOpen((prev) => ({ seq: (prev?.seq ?? 0) + 1, entries, client: { x: rect.left, y: rect.bottom }, source }));
  };

  return (
    <>
      {anchor}
      <button
        ref={button}
        type="button"
        className={`${f.frame} ${s.popTrigger}`}
        aria-haspopup="menu"
        aria-expanded={open !== null}
        onClick={(e) => {
          if (wasOpen.current) {
            wasOpen.current = false;
            return;
          }
          // A click with no pointer under it came from the keyboard, which highlights the first row.
          show(e.detail === 0 ? 'keyboard' : 'pointer');
        }}
      >
        <span>{label}</span>
        <Caret className={s.caret} />
      </button>
      {open && ready && target && createPortal(<OpenPanels key={open.seq} open={open} close={close} />, target)}
    </>
  );
}
