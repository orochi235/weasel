import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { MenuController, MenuEntry, Rect } from '@weasel-js/menu';
import { placeMenu, placeSubmenu } from '@weasel-js/menu';
import { MenuRow } from './MenuRow';
import s from './ContextMenu.module.css';

/** One level of the open menu, positioned in the viewport. */
export function MenuPanel(props: {
  controller: MenuController; level: number; entries: readonly MenuEntry[];
  highlight: number | null; childOpen: boolean; idBase: string;
  anchor: { x: number; y: number } | null;
  parentRow: () => Rect | null;
  focus: boolean;
  register(el: HTMLElement | null): void;
}) {
  const { controller: c, level, entries, highlight, idBase, parentRow, anchor, focus } = props;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = { w: el.offsetWidth, h: el.offsetHeight };
    const bounds = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const row = parentRow();
    const at = row ? placeSubmenu(size, row, bounds) : placeMenu(size, anchor ?? { x: 0, y: 0 }, bounds);
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    c.setPanel(level, { x: at.x, y: at.y, w: size.w, h: size.h });
    // Placed once per mount: the host remounts a panel when the row it hangs from changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, level, anchor]);

  useLayoutEffect(() => { if (focus) ref.current?.focus(); }, [focus]);

  // Every key stops here, so Shift+F10 or the ContextMenu key inside a menu never
  // reaches the canvas; a key held with Ctrl, Meta or Alt is a command, not typeahead.
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (c.key(e.key)) e.preventDefault();
  };

  return (
    <div
      ref={(el) => { ref.current = el; props.register(el); }}
      role="menu"
      tabIndex={-1}
      className={s.panel}
      aria-activedescendant={highlight == null ? undefined : `${idBase}-${level}-${highlight}`}
      onKeyDown={onKeyDown}
      onPointerLeave={() => c.hover(level, null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) => (
        <MenuRow
          key={entry.key}
          entry={entry}
          id={`${idBase}-${level}-${i}`}
          highlighted={highlight === i}
          expanded={highlight === i && props.childOpen}
          onHover={(e) => c.hover(level, i, { x: e.clientX, y: e.clientY })}
          onPress={() => c.press(level, i)}
        />
      ))}
    </div>
  );
}
