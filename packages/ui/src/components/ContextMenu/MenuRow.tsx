import type { MouseEvent, PointerEvent } from 'react';
import type { MenuEntry } from '@weasel-js/menu';
import { formatShortcut } from '../ToolPalette/formatShortcut';
import { Caret } from '../Caret';
import { actionIcon, type ActionIconSource } from '../../icons/actionIcon';
import { AccessLabel } from './AccessLabel';
import s from './ContextMenu.module.css';

const leftToBrowser = (e: MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey;

/** One line of a panel. Rows are `div`s: the panel owns focus and points at
 *  the highlighted row with `aria-activedescendant`. An item with an `href` is an `a`. */
export function MenuRow(props: {
  entry: MenuEntry; id: string; highlighted: boolean; expanded: boolean;
  /** The id of the panel a submenu row opens. */
  controls: string;
  onHover(e: PointerEvent): void; onPress(): void;
  /** A click the browser follows itself, such as a new-tab one: only the menu closes. */
  onLeave(): void;
  /** A primary-button release over the row; `modified` for a link released with Meta, Ctrl or Shift held. */
  onRelease(modified: boolean): void;
}) {
  const { entry: e, id, highlighted, expanded } = props;
  if (e.kind === 'separator') return <div role="separator" className={s.separator} />;
  const checkable = e.kind === 'item' && e.checked !== undefined;
  const link = e.kind === 'item' && e.href !== undefined;
  const current = e.kind === 'item' && e.current;

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
    'aria-disabled': e.disabled || undefined,
    'aria-checked': checkable ? e.checked : undefined,
    'aria-current': current ? ('page' as const) : undefined,
    'aria-haspopup': e.kind === 'submenu' ? ('menu' as const) : undefined,
    'aria-expanded': e.kind === 'submenu' ? expanded : undefined,
    'aria-controls': e.kind === 'submenu' && expanded ? props.controls : undefined,
    onPointerMove: props.onHover,
    onPointerUp: (ev: PointerEvent) => { if (!e.disabled) props.onRelease(link && leftToBrowser(ev)); },
    onClick,
  };
  const content = (
    <>
      <span className={s.icon} aria-hidden="true">{e.kind === 'item' && e.checked ? '✓' : actionIcon(e.icon as ActionIconSource)}</span>
      <AccessLabel label={e.label} access={e.access} />
      {e.kind === 'item' && e.shortcut && <span className={s.shortcut}>{formatShortcut(e.shortcut)}</span>}
      {e.kind === 'submenu' && <Caret className={s.caret} />}
    </>
  );
  if (!link) return <div {...common}>{content}</div>;
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
