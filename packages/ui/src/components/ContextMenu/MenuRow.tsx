import type { PointerEvent } from 'react';
import type { MenuEntry } from '@weasel-js/menu';
import { formatShortcut } from '../ToolPalette/formatShortcut';
import { Caret } from '../Caret';
import { resolveIcon } from '../../icons/resolveIcon';
import s from './ContextMenu.module.css';

/** One line of a panel. Rows are `div`s: the panel owns focus and points at
 *  the highlighted row with `aria-activedescendant`. */
export function MenuRow(props: {
  entry: MenuEntry; id: string; highlighted: boolean; expanded: boolean;
  /** The id of the panel a submenu row opens. */
  controls: string;
  onHover(e: PointerEvent): void; onPress(): void;
}) {
  const { entry: e, id, highlighted, expanded } = props;
  if (e.kind === 'separator') return <div role="separator" className={s.separator} />;
  const checkable = e.kind === 'item' && e.checked !== undefined;
  return (
    <div
      id={id}
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      className={s.row}
      data-highlighted={highlighted || undefined}
      aria-disabled={e.disabled || undefined}
      aria-checked={checkable ? e.checked : undefined}
      aria-haspopup={e.kind === 'submenu' ? 'menu' : undefined}
      aria-expanded={e.kind === 'submenu' ? expanded : undefined}
      aria-controls={e.kind === 'submenu' && expanded ? props.controls : undefined}
      onPointerMove={props.onHover}
      onClick={props.onPress}
    >
      <span className={s.icon} aria-hidden="true">{e.kind === 'item' && e.checked ? '✓' : resolveIcon(typeof e.icon === 'string' ? e.icon : undefined, 16)}</span>
      <span className={s.label}>{e.label}</span>
      {e.kind === 'item' && e.shortcut && <span className={s.shortcut}>{formatShortcut(e.shortcut)}</span>}
      {e.kind === 'submenu' && <Caret className={s.caret} />}
    </div>
  );
}
