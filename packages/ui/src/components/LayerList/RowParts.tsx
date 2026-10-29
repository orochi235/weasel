import { type KeyboardEvent, useRef, useState } from 'react';
import { imeKey } from '@weasel-js/headless';
import rows from '../ItemList/ItemList.module.css';
import type { LayerListItem, LayerListProps } from './layerListProps';
import s from './LayerList.module.css';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';

// Keeps a press on a control inside a row from also starting the row's press.
export const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

/** Whether `item`'s label can be edited in place under `props`. */
export function canRename(props: LayerListProps, item: LayerListItem): boolean {
  return props.onRename !== undefined && !item.fixed && !item.locked && item.renamable !== false;
}

/**
 * A row's label, or the field renaming it while `renaming` holds. Enter or
 * leaving the field reports a changed, non-blank name; Escape drops it. Either
 * way focus goes back to the row.
 */
export function RowLabel({
  item,
  props,
  renaming,
  setRenaming,
}: {
  item: LayerListItem;
  props: LayerListProps;
  renaming: boolean;
  setRenaming: (on: boolean) => void;
}) {
  const renamable = canRename(props, item);
  if (renaming && renamable) return <RenameField item={item} props={props} close={() => setRenaming(false)} />;
  return (
    <span className={rows.label} onDoubleClick={renamable ? () => setRenaming(true) : undefined}>
      {item.title ?? item.label}
    </span>
  );
}

function RenameField({ item, props, close }: { item: LayerListItem; props: LayerListProps; close: () => void }) {
  const [draft, setDraft] = useState(item.label);
  // Enter and Escape close the field, and its removal can blur it again after.
  const closed = useRef(false);
  const finish = (commit: boolean, row: HTMLElement | null) => {
    if (closed.current) return;
    closed.current = true;
    close();
    const name = draft.trim();
    if (commit && name !== '' && name !== item.label) props.onRename?.(item.id, name);
    row?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if ((e.key !== 'Enter' && e.key !== 'Escape') || imeKey(e.nativeEvent)) return;
    e.preventDefault();
    finish(e.key === 'Enter', e.currentTarget.closest<HTMLElement>('[role="row"]'));
  };
  return (
    <input
      className={s.rename}
      aria-label={`Rename ${item.label}`}
      value={draft}
      // The field opens on the user's own gesture, so taking focus is expected.
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      onDoubleClick={stop}
      onBlur={() => finish(true, null)}
    />
  );
}

/** The lock toggle on a layer that is not fixed, when the list has `onLockChange`. */
export function LockToggle({ item, props }: { item: LayerListItem; props: LayerListProps }) {
  const { onLockChange } = props;
  if (!onLockChange) return null;
  if (item.fixed) return <span className={s.lockToggle} />;
  const locked = item.locked === true;
  return (
    <button
      type="button"
      className={s.lockToggle}
      aria-label={`Lock ${item.label}`}
      aria-pressed={locked}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onLockChange(item.id, !locked);
      }}
    >
      <Icon name={icon(locked ? 'lock' : 'unlock')} size={12} />
    </button>
  );
}
