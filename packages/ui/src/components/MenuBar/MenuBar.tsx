import { createContext, useCallback, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLatest, type OpenMenu } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { useOverlayPortal } from '../../overlays/portalHost';
import { Bar, valueAt } from '../Bar/Bar';
import { useBarMenuResolver } from '../Bar/BarMenu';
import { barMenuRoot } from '../Bar/barMenuRoot';
import { AccessLabel } from '../ContextMenu/AccessLabel';
import { OpenPanels } from '../ContextMenu/ContextMenuHost';
import { menuBarTitles, type MenuBarTitle } from './menuBarTitles';
import s from './MenuBar.module.css';

/** The modifiers held with a title's access letter to open its menu from anywhere in the app. */
export interface MenuAccessChord {
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** Props for {@link MenuBar}. */
export interface MenuBarProps {
  /** A bar of menu groups: each top-level group drawn `as: 'menu'` is a title, and each run of anything else is
   *  drawn between them as a {@link Bar} draws it. */
  schema: PrefGroup;
  /** The schema an alias in a menu points into. Default: `schema`. */
  over?: PrefGroup;
  /** Each leaf's value, keyed by dotted path. */
  values?: Readonly<Record<string, unknown>>;
  /** A leaf edit, as the dotted path it was declared at and its new value. */
  onChange?: (path: string, value: unknown) => void;
  /** Names the bar. Default `'Menu bar'`. */
  label?: string;
  /** What is held with a title's access letter to open it. Default `{ alt: true }`. */
  accessChord?: MenuAccessChord;
  className?: string;
}

/** What the bar's key layer drives it through. */
export interface MenuBarHandle {
  /** Focus the title that last had focus, else the first. */
  focus(): void;
  /** Open a title's menu, as from the keyboard. */
  open(key: string): void;
}

/** The enclosing bar's handle, for the key layer drawn inside it. */
export const MenuBarHandleContext = createContext<MenuBarHandle | null>(null);

type MenuTitle = Extract<MenuBarTitle, { kind: 'menu' }>;
interface Opened { key: string; menu: OpenMenu; release: boolean }

/**
 * A bar of menus across the top of an app: a title per menu group, each opening its group as the context menu's
 * panels do, with the pointer and keyboard behavior of a desktop menu bar.
 */
export function MenuBar({ schema, over, values, onChange, label = 'Menu bar', className }: MenuBarProps) {
  const titles = useMemo(() => menuBarTitles(schema), [schema]);
  const menus = titles.filter((t): t is MenuTitle => t.kind === 'menu');
  const resolve = useBarMenuResolver();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const bar = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const seq = useRef(0);
  const openedNow = useLatest(opened);
  const { onFocus, leave } = useFocusReturn(bar);
  const idBase = useId();
  const titleId = (key: string) => `${idBase}-${key}`;
  const { anchor, container, ready } = useOverlayPortal();
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);

  const show = (key: string, source: OpenMenu['source'], release = false) => {
    const title = menus.find((m) => m.key === key);
    const el = buttons.current.get(key);
    if (!title || !el) return;
    setActive(key);
    const entries = resolve(barMenuRoot(title.group, key), { values: (path) => valueAt(values, path), onChange, over: over ?? schema });
    if (entries.length === 0) {
      setOpened(null);
      if (source === 'keyboard') el.focus();
      return;
    }
    const r = el.getBoundingClientRect();
    const menu: OpenMenu = { seq: ++seq.current, entries, client: { x: r.left, y: r.bottom }, under: { x: r.left, y: r.top, w: r.width, h: r.height }, source };
    setOpened({ key, menu, release });
  };
  const showNow = useLatest(show);

  const close = useCallback(() => {
    const key = openedNow.current?.key;
    setOpened(null);
    if (key && document.activeElement?.closest('[role="menu"]')) buttons.current.get(key)?.focus();
  }, [openedNow]);

  const inside = useCallback(
    (t: EventTarget | null) => t instanceof Node && [...buttons.current.values()].some((b) => b.contains(t)),
    [],
  );

  const neighbor = (key: string, dir: -1 | 1) => {
    const i = menus.findIndex((m) => m.key === key);
    return menus[(i + dir + menus.length) % menus.length]!.key;
  };
  const activeKey = active ?? menus[0]?.key;

  const handle = useMemo((): MenuBarHandle => ({
    focus: () => { const b = bar.current?.querySelector<HTMLElement>('[role="menuitem"][tabindex="0"]'); b?.focus(); },
    open: (key) => showNow.current(key, 'keyboard'),
  }), [showNow]);

  const onTitleKey = (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const next = neighbor(key, e.key === 'ArrowRight' ? 1 : -1);
      setActive(next);
      buttons.current.get(next)?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      show(key, 'keyboard');
    } else if (e.key === 'Escape') {
      if (opened) close();
      else leave(e.currentTarget);
    } else return;
    e.preventDefault();
  };

  return (
    <MenuBarHandleContext.Provider value={handle}>
      {anchor}
      <div ref={bar} role="menubar" aria-label={label} className={className ? `${s.bar} ${className}` : s.bar} onFocus={onFocus}>
        {titles.map((t) => (t.kind === 'other'
          ? <Bar key={t.key} schema={t.schema} over={over ?? schema} values={values} onChange={onChange} />
          : (
            <button
              key={t.key}
              ref={(el) => { if (el) buttons.current.set(t.key, el); else buttons.current.delete(t.key); }}
              id={titleId(t.key)}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={opened?.key === t.key}
              tabIndex={t.key === activeKey ? 0 : -1}
              className={s.title}
              onFocus={() => setActive(t.key)}
              // The menu takes focus as it opens; the press must not move it back to the title.
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (opened?.key === t.key) close();
                else show(t.key, 'pointer', true);
              }}
              onPointerEnter={(e) => { if (opened && opened.key !== t.key) show(t.key, 'pointer', (e.buttons & 1) === 1); }}
              onClick={(e) => { if (e.detail === 0 && opened?.key !== t.key) show(t.key, 'keyboard'); }}
              onKeyDown={(e) => onTitleKey(e, t.key)}
            >
              <AccessLabel label={t.name} access={t.access} />
            </button>
          )))}
      </div>
      {opened && ready && target && createPortal(
        <OpenPanels
          key={opened.menu.seq}
          open={opened.menu}
          close={close}
          labelledBy={titleId(opened.key)}
          inside={inside}
          onEdge={(dir) => show(neighbor(opened.key, dir), 'keyboard')}
          releaseRuns={opened.release}
        />,
        target,
      )}
    </MenuBarHandleContext.Provider>
  );
}

/** Remembers what had focus when focus entered the bar from outside, and gives it back on `leave`, else drops it. */
function useFocusReturn(bar: { readonly current: HTMLElement | null }) {
  const returnTo = useRef<HTMLElement | null>(null);
  // Focus events from the open menu's portal bubble here too, so a move between a title and its menu is not an entry.
  const onFocus = (e: FocusEvent) => {
    const from = e.relatedTarget;
    if (from instanceof Element && (bar.current?.contains(from) || from.closest('[role="menu"]'))) return;
    returnTo.current = from instanceof HTMLElement ? from : null;
  };
  const leave = (from: HTMLElement) => {
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus();
    else from.blur();
  };
  return { onFocus, leave };
}
