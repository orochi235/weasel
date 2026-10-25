import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLatest, type OpenMenu } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar, barReader } from '../Bar/Bar';
import { useBarMenuResolver } from '../Bar/BarMenu';
import { barMenuRoot } from '../Bar/barMenuRoot';
import { OpenPanels } from '../ContextMenu/ContextMenuHost';
import { menuUnder } from '../ContextMenu/menuUnder';
import { useMenuPortal } from '../ContextMenu/useMenuPortal';
import { shownMenuBar, type MenuBarPart as Title } from './menuBarTitles';
import { MenuBarTitle } from './MenuBarTitle';
import { useMenuBarFocus } from './useMenuBarFocus';
import { MenuBarHandleContext, type MenuAccessChord, type MenuBarHandle } from './menuBarHandle';
import { MenuBarKeys } from './useMenuBarKeys';
import s from './MenuBar.module.css';

export type { MenuAccessChord } from './menuBarHandle';

/** Props for {@link MenuBar}. */
export interface MenuBarProps {
  /** A bar of menu groups: each top-level group drawn `as: 'menu'` is a title. Anything else at the top level is
   *  drawn after the titles as a {@link Bar} draws it. A title is hidden by its `showIf` and disabled by its
   *  `enableIf`. */
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

type MenuTitle = Extract<Title, { kind: 'menu' }>;
interface Opened { key: string; menu: OpenMenu; release: boolean }
const ALT: MenuAccessChord = { alt: true };

/**
 * A bar of menus across the top of an app: a title per menu group, each opening its group as the context menu's
 * panels do, with the pointer and keyboard behavior of a desktop menu bar.
 */
export function MenuBar({ schema, over, values, onChange, label = 'Menu bar', accessChord = ALT, className }: MenuBarProps) {
  const read = barReader(schema, values, over);
  const { titles, disabled } = shownMenuBar(schema, read, over);
  const menus = titles.filter((t): t is MenuTitle => t.kind === 'menu');
  const resolve = useBarMenuResolver();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const bar = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const seq = useRef(0);
  const openedNow = useLatest(opened);
  const focus = useMenuBarFocus(bar);
  const idBase = useId();
  const titleId = (key: string) => `${idBase}-${key}`;
  const { anchor, target } = useMenuPortal();

  const show = (key: string, source: OpenMenu['source'], release = false) => {
    const title = menus.find((m) => m.key === key);
    const el = buttons.current.get(key);
    if (!title || !el || disabled.has(key)) return;
    setActive(key);
    const entries = resolve(barMenuRoot(title.group, key), { values: read, onChange, over: over ?? schema });
    if (entries.length === 0) {
      setOpened(null);
      if (source === 'keyboard') el.focus();
      return;
    }
    focus.opening();
    setOpened({ key, menu: menuUnder(el, entries, source, ++seq.current), release });
  };
  const showNow = useLatest(show);

  const close = useCallback(() => {
    const key = openedNow.current?.key;
    setOpened(null);
    focus.closed(key === undefined ? undefined : buttons.current.get(key));
  }, [openedNow, focus]);

  // A title that can no longer open takes its menu with it; set during render so the stranded menu never commits.
  if (opened !== null && (disabled.has(opened.key) || !menus.some((m) => m.key === opened.key))) setOpened(null);

  const inside = useCallback(
    (t: EventTarget | null) => t instanceof Node && [...buttons.current.values()].some((b) => b.contains(t)),
    [],
  );

  // The next title along, wrapping; with `enabled`, the next one that can open.
  const neighbor = (key: string, dir: -1 | 1, enabled = false) => {
    let i = menus.findIndex((m) => m.key === key);
    for (let n = 0; n < menus.length; n++) {
      i = (i + dir + menus.length) % menus.length;
      if (!enabled || !disabled.has(menus[i]!.key)) return menus[i]!.key;
    }
    return key;
  };

  const handle = useMemo((): MenuBarHandle => ({
    focus: () => bar.current?.querySelector<HTMLElement>('[role="menuitem"][tabindex="0"]')?.focus(),
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
      else focus.leave(e.currentTarget);
    } else return;
    e.preventDefault();
  };

  const activeKey = menus.some((m) => m.key === active) ? active : menus[0]?.key;
  return (
    <MenuBarHandleContext.Provider value={handle}>
      {anchor}
      <MenuBarKeys titles={menus} disabled={disabled} chord={accessChord} />
      <div className={className ? `${s.root} ${className}` : s.root}>
        <div ref={bar} role="menubar" aria-label={label} className={s.bar} onFocus={focus.onFocus}>
          {menus.map((t) => (
            <MenuBarTitle
              key={t.key}
              id={titleId(t.key)}
              name={t.name}
              access={t.access}
              expanded={opened?.key === t.key}
              disabled={disabled.has(t.key)}
              tabbable={t.key === activeKey}
              register={(el) => { if (el) buttons.current.set(t.key, el); else buttons.current.delete(t.key); }}
              onFocus={() => setActive(t.key)}
              onPress={() => { if (opened?.key === t.key) close(); else show(t.key, 'pointer', true); }}
              onEnter={(held) => { if (opened && opened.key !== t.key) show(t.key, 'pointer', held); }}
              onActivate={() => { if (opened?.key !== t.key) show(t.key, 'keyboard'); }}
              onKey={(e) => onTitleKey(e, t.key)}
            />
          ))}
        </div>
        {titles.map((t) => t.kind === 'other' && (
          <Bar key={t.key} schema={t.schema} over={over ?? schema} values={values} onChange={onChange} />
        ))}
      </div>
      {opened && target && createPortal(
        <OpenPanels
          key={opened.menu.seq}
          open={opened.menu}
          close={close}
          labelledBy={titleId(opened.key)}
          inside={inside}
          onEdge={(dir) => show(neighbor(opened.key, dir, true), 'keyboard')}
          releaseRuns={opened.release}
        />,
        target,
      )}
    </MenuBarHandleContext.Provider>
  );
}
