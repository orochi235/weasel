import { type MouseEventHandler, useState } from 'react';
import { CloseButton } from '../CloseButton';
import { Disclosure } from '../Disclosure';
import { DragGrip } from '../DragGrip';
import rows from '../ItemList/ItemList.module.css';
import type { Shared } from './LayerList';
import type { LayerListItem } from './layerListProps';
import s from './LayerList.module.css';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { canRename, LockToggle, RowLabel, stop } from './RowParts';

interface RowProps {
  item: LayerListItem;
  shared: Shared;
  parentId: string | null;
  /** The row's depth in the treegrid that holds it. */
  level: number;
  /** Drawn in a drag's ghost: no role, no keys, no remove. */
  ghosted: boolean;
  selected: boolean;
  open: boolean;
  /** The id of the element holding the row's children. */
  childId: string;
  onPointerDown: ((e: React.PointerEvent) => void) | undefined;
}

/** The right-click handler for a layer's root element, none for a ghost or when the list has no handler. */
export function rowContextMenu(shared: Shared, item: LayerListItem, ghosted: boolean): MouseEventHandler | undefined {
  const handler = shared.props.onRowContextMenu;
  return ghosted || !handler ? undefined : (e) => handler(item.id, e);
}

/** A layer with no body: one line, and one row of its treegrid. */
export function Row({ item, shared, parentId, level, ghosted, selected, open, childId, onPointerDown }: RowProps) {
  const { props } = shared;
  const branch = (item.children?.length ?? 0) > 0;
  const [renaming, setRenaming] = useState(false);
  const keyDown = shared.keys.onKeyDown(item, parentId);
  return (
    <div
      className={[rows.row, s.row, selected ? rows.selected : '', item.nonPrinting ? s.nonPrinting : ''].filter(Boolean).join(' ')}
      data-selected={selected ? 'true' : undefined}
      data-non-printing={item.nonPrinting ? 'true' : undefined}
      data-fixed={item.fixed ? 'true' : undefined}
      data-locked={item.locked ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onContextMenu={rowContextMenu(shared, item, ghosted)}
      {...(ghosted
        ? {}
        : {
            role: 'row',
            'aria-level': level,
            ...(branch ? { 'aria-expanded': open } : {}),
            ...(props.onSelect ? { 'aria-selected': selected } : {}),
            tabIndex: shared.keys.tabStop === item.id ? 0 : -1,
            ref: shared.keys.register(item.id),
            onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
              if (e.key === 'F2' && e.target === e.currentTarget && canRename(props, item)) {
                e.preventDefault();
                setRenaming(true);
              } else keyDown(e);
            },
            onFocus: () => shared.keys.onFocus(item.id),
          })}
    >
      <div className={s.cell} {...(ghosted ? {} : { role: 'gridcell' })}>
        {shared.nested &&
          (branch ? (
            <span className={s.stop} onPointerDown={stop}>
              <Disclosure
                open={open}
                onToggle={() => shared.toggle(item.id)}
                label={`${item.label} sublayers`}
                controls={childId}
              />
            </span>
          ) : (
            <span className={s.twistyGap} />
          ))}
        <Grip item={item} reorder={props.onReorder !== undefined} />
        {props.onVisibilityChange &&
          (item.fixed || item.hideable === false ? (
            <span className={s.check} />
          ) : (
            <input
              className={s.check}
              type="checkbox"
              checked={item.visible !== false}
              onPointerDown={stop}
              onChange={(e) => props.onVisibilityChange?.(item.id, e.target.checked)}
              aria-label={`Show ${item.label}`}
            />
          ))}
        <LockToggle item={item} props={props} />
        {item.leading}
        <RowLabel item={item} props={props} renaming={renaming} setRenaming={setRenaming} />
        {item.nonPrinting && <NonPrintingMark />}
        {ghosted ? null : <Remove item={item} shared={shared} />}
      </div>
    </div>
  );
}

/** Marks a row that export leaves out. */
function NonPrintingMark() {
  return (
    <span className={s.nonPrintingMark}>Not printed</span>
  );
}

/** A row's grip: decoration, since the whole row takes the drag. */
function Grip({ item, reorder }: { item: LayerListItem; reorder: boolean }) {
  if (item.fixed) {
    return (
      <span className={s.lock} role="img" aria-label="Locked">
        <Icon name={icon('lock')} size={12} />
      </span>
    );
  }
  if (!reorder && item.badge === undefined) return null;
  return (
    <span className={s.grip} aria-hidden="true">
      {item.badge ?? <DragGrip size={13} />}
    </span>
  );
}

/** A card's handle: the drag target, since the rest of its head folds it, and
 *  Alt+Up/Down on it moves the card. */
export function Handle({
  item,
  reorder,
  onPointerDown,
  onNudge,
}: {
  item: LayerListItem;
  reorder: boolean;
  onPointerDown: ((e: React.PointerEvent) => void) | undefined;
  onNudge: (delta: -1 | 1) => void;
}) {
  if (item.fixed || item.locked || !reorder) return <Grip item={item} reorder={reorder} />;
  return (
    <button
      type="button"
      className={s.handle}
      aria-label={`Drag to reorder ${item.label}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        onNudge(e.key === 'ArrowUp' ? -1 : 1);
      }}
    >
      {item.badge ?? <DragGrip />}
    </button>
  );
}

export function Controls({ item, shared }: { item: LayerListItem; shared: Shared }) {
  const { onVisibilityChange } = shared.props;
  return (
    <>
      {onVisibilityChange && !item.fixed && item.hideable !== false && (
        <input
          className={s.check}
          type="checkbox"
          checked={item.visible !== false}
          onClick={stop}
          onChange={(e) => onVisibilityChange(item.id, e.target.checked)}
          aria-label={`Show ${item.label}`}
        />
      )}
      {shared.props.onLockChange && !item.fixed && <LockToggle item={item} props={shared.props} />}
      <Remove item={item} shared={shared} />
    </>
  );
}

function Remove({ item, shared }: { item: LayerListItem; shared: Shared }) {
  const { onRemove } = shared.props;
  if (!onRemove || item.fixed || item.locked || item.removable === false) return null;
  return (
    <span className={s.stop} onPointerDown={stop}>
      <CloseButton
        ariaLabel={`Remove ${item.label}`}
        onClick={() => {
          shared.keys.onRemoving(item.id);
          onRemove(item.id);
        }}
      />
    </span>
  );
}
