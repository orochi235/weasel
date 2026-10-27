import { useRef, type MouseEvent, type PointerEvent } from 'react';
import type { MenuController, MenuEntry } from '@weasel-js/menu';
import { formatShortcut } from '@weasel-js/gestures';
import { Caret } from '../Caret';
import { resolveIcon } from '../../icons/resolveIcon';
import { AccessLabel } from './AccessLabel';
import { MenuNumberValue, MenuTextValue } from './MenuValue';
import { MenuColorValue, editsColor } from './MenuColorValue';
import s from './ContextMenu.module.css';

const leftToBrowser = (e: MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey;

/** One line of a panel. Rows are `div`s: the panel owns focus and points at
 *  the highlighted row with `aria-activedescendant`. An item with an `href` is an `a`. A number or text row
 *  holds a field, which takes focus only when pressed or on Enter. */
export function MenuRow(props: {
  entry: MenuEntry; id: string; highlighted: boolean; expanded: boolean;
  controller: MenuController;
  /** The id of the panel a submenu row opens. */
  controls: string;
  onHover(e: PointerEvent): void; onPress(): void;
  /** A click the browser follows itself, such as a new-tab one: only the menu closes. */
  onLeave(): void;
  /** A primary-button release over the row; `modified` for a link released with Meta, Ctrl or Shift held. */
  onRelease(modified: boolean): void;
  /** A color row's picker is open. */
  picking: boolean;
  onPicked(): void;
}) {
  const { entry: e, id, highlighted, expanded } = props;
  const row = useRef<HTMLDivElement>(null);
  if (e.kind === 'separator') return <div role="separator" className={s.separator} />;
  const checkable = e.kind === 'item' && e.checked !== undefined;
  const link = e.kind === 'item' && e.href !== undefined;
  const current = e.kind === 'item' && e.current;
  const picks = e.kind === 'color' && editsColor(e);

  const onClick = (ev: MouseEvent) => {
    const browser = link && !e.disabled && leftToBrowser(ev);
    if (link && !browser) ev.preventDefault();
    if (browser) props.onLeave();
    else props.onPress();
  };
  const common = {
    id,
    role: checkable ? 'menuitemcheckbox' : 'menuitem',
    className: current ? `${s.row} ${s.current}` : s.row,
    'data-highlighted': highlighted || undefined,
    'aria-disabled': e.disabled || (e.kind === 'color' && !e.set) || undefined,
    'aria-checked': checkable ? e.checked : undefined,
    'aria-current': current ? ('page' as const) : undefined,
    'aria-haspopup': e.kind === 'submenu' ? ('menu' as const) : picks ? ('dialog' as const) : undefined,
    'aria-expanded': e.kind === 'submenu' ? expanded : picks ? props.picking : undefined,
    'aria-controls': e.kind === 'submenu' && expanded ? props.controls : undefined,
    onPointerMove: props.onHover,
    onPointerUp: (ev: PointerEvent) => { if (!e.disabled) props.onRelease(link && leftToBrowser(ev)); },
    onClick,
  };
  const content = (
    <>
      <span className={s.icon} aria-hidden="true">{e.kind === 'item' && e.checked ? '✓' : resolveIcon(e.kind !== 'color' && typeof e.icon === 'string' ? e.icon : undefined, 16)}</span>
      <AccessLabel label={e.label} access={e.access} />
      {e.kind === 'item' && e.shortcut && <span className={s.shortcut}>{formatShortcut(e.shortcut)}</span>}
      {e.kind === 'number' && <MenuNumberValue entry={e} rowId={id} controller={props.controller} />}
      {e.kind === 'color' && (
        <MenuColorValue entry={e} controller={props.controller} row={row} picking={props.picking} onPicked={props.onPicked} />
      )}
      {e.kind === 'text' && <MenuTextValue entry={e} rowId={id} controller={props.controller} />}
      {e.kind === 'submenu' && <Caret className={s.caret} />}
    </>
  );
  if (!link) return <div ref={row} {...common}>{content}</div>;
  return (
    <a
      {...common}
      href={e.kind === 'item' && !e.disabled ? e.href : undefined}
      onAuxClick={(ev) => { if (ev.button === 1 && !e.disabled) props.onLeave(); }}
    >
      {content}
    </a>
  );
}
