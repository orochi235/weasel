import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { MenuController, MenuEntry, MenuSide, Rect } from '@weasel-js/menu';
import { placeMenu, placeMenuUnder, placeSubmenu } from '@weasel-js/menu';
import { blockFrame, clientToBlock, containingBlock } from '../../overlays/blockFrame';
import { MenuRow } from './MenuRow';
import { menuFieldId } from './MenuValue';
import s from './ContextMenu.module.css';

/** One level of the open menu, positioned in the viewport. */
export function MenuPanel(props: {
  controller: MenuController; level: number; entries: readonly MenuEntry[];
  highlight: number | null; childOpen: boolean; idBase: string;
  /** The row a submenu hangs from. */
  labelledBy?: string;
  anchor: { client: { x: number; y: number }; under?: Rect; side?: MenuSide } | null;
  parentRow: () => Rect | null;
  focus: boolean;
  /** While true, a pointerup over a row presses it. Read at the event, never rendered from. */
  releaseRuns: { readonly current: boolean };
  close(): void;
  register(el: HTMLElement | null): void;
}) {
  const { controller: c, level, entries, highlight, idBase, parentRow, anchor, focus } = props;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Placed in client px, and written in the px of the box the panel is fixed in, which a magnifier may draw larger.
    const frame = blockFrame(containingBlock(el));
    const size = { w: el.offsetWidth * frame.scaleX, h: el.offsetHeight * frame.scaleY };
    const bounds = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const row = parentRow();
    const at = row ? placeSubmenu(size, row, bounds)
      : anchor?.under ? placeMenuUnder(size, anchor.under, bounds, anchor.side)
        : placeMenu(size, anchor?.client ?? { x: 0, y: 0 }, bounds);
    const own = clientToBlock(at, frame);
    el.style.left = `${own.x}px`;
    el.style.top = `${own.y}px`;
    c.setPanel(level, { x: at.x, y: at.y, w: size.w, h: size.h });
    // Placed once per mount: the host remounts a panel when the row it hangs from changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, level, anchor]);

  useLayoutEffect(() => { if (focus) ref.current?.focus(); }, [focus]);

  // Every key stops here, so Shift+F10 or the ContextMenu key inside a menu never
  // reaches the canvas; a key held with Ctrl, Meta or Alt is a command, not typeahead.
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    // A key typed into a row's field is the field's; Enter and Escape, which end the edit, give focus back.
    if (e.target !== e.currentTarget) {
      if (e.key === 'Enter' || e.key === 'Escape') ref.current?.focus();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const at = highlight == null ? undefined : entries[highlight];
    if (e.key === 'Enter' && (at?.kind === 'number' || at?.kind === 'text') && !at.disabled) {
      e.preventDefault();
      document.getElementById(menuFieldId(`${idBase}-${level}-${highlight}`))?.focus();
      return;
    }
    if (c.key(e.key)) e.preventDefault();
  };

  return (
    <div
      ref={(el) => { ref.current = el; props.register(el); }}
      id={`${idBase}-panel-${level}`}
      role="menu"
      data-weasel-overlay=""
      tabIndex={-1}
      aria-labelledby={props.labelledBy}
      className={s.panel}
      aria-activedescendant={highlight == null ? undefined : `${idBase}-${level}-${highlight}`}
      onKeyDown={onKeyDown}
      onPointerLeave={() => c.hover(level, null)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {entries.map((entry, i) => (
        <MenuRow
          key={entry.key}
          entry={entry}
          controller={c}
          id={`${idBase}-${level}-${i}`}
          highlighted={highlight === i}
          expanded={highlight === i && props.childOpen}
          controls={`${idBase}-panel-${level + 1}`}
          onHover={(e) => c.hover(level, i, { x: e.clientX, y: e.clientY })}
          onPress={() => c.press(level, i)}
          onLeave={props.close}
          onRelease={(modified) => {
            if (!props.releaseRuns.current) return;
            if (modified && entry.kind === 'item' && entry.href !== undefined) {
              window.open(entry.href, '_blank');
              props.close();
            } else c.press(level, i);
          }}
        />
      ))}
    </div>
  );
}
