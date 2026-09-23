import type { ReactNode } from 'react';
import { useRef } from 'react';
import {
  ItemList,
  useReorderDragList,
  type ItemListRow,
  type LayerListItem,
  type PressModifiers,
} from '@weasel-js/ui';
import s from './LayerList.module.css';

export type { LayerListItem };

export interface LayerListProps {
  items: LayerListItem[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  onReorder(ids: string[], targetIndex: number): void;
  className?: string;
  empty?: ReactNode;
}

export function LayerList(props: LayerListProps) {
  const { items, selectedIds, onSelect, onReorder, className, empty } = props;
  // The session ends before React flushes, so the callback must read the
  // current selection rather than the one it closed over.
  const propsRef = useRef({ selectedIds, onSelect });
  propsRef.current = { selectedIds, onSelect };

  const press = (id: string, mods: PressModifiers) => {
    const { selectedIds: sel, onSelect: sel_cb } = propsRef.current;
    const targetItem = items.find((it) => it.id === id);
    if (targetItem?.locked) {
      // Locked rows are always exclusive — ignore shift modifier so they
      // never combine with other rows in a multi-selection.
      sel_cb([id]);
    } else if (mods.shiftKey) {
      // Strip any currently-selected locked ids before applying the toggle
      // so a leftover locked selection (e.g., Page) doesn't carry through
      // when the user starts building a multi-selection of regular rows.
      const lockedIds = new Set(items.filter((it) => it.locked).map((it) => it.id));
      const filtered = sel.filter((x) => !lockedIds.has(x));
      if (filtered.includes(id)) {
        sel_cb(filtered.filter((x) => x !== id));
      } else {
        sel_cb([...filtered, id]);
      }
    } else {
      sel_cb([id]);
    }
  };
  // Locked rows never join a multi-selection, so a range passes over them.
  const selectRange = (ids: string[]) => {
    const locked = new Set(items.filter((it) => it.locked).map((it) => it.id));
    const range = ids.filter((id) => !locked.has(id));
    if (range.length > 0) propsRef.current.onSelect(range);
  };
  const drag = useReorderDragList({ items, selectedIds, onReorder, onPress: press });

  const rows: ItemListRow[] = items.map((item, i) => {
    const isSelected = selectedIds.includes(item.id);
    return {
      id: item.id,
      label: item.label,
      selected: isSelected,
      dragging: drag.state.draggedIds?.includes(item.id) ?? false,
      leading: item.swatch !== undefined
        ? <span className={s.swatch} style={{ background: item.swatch }} aria-hidden="true" />
        : undefined,
      rowProps: {
        'data-row-index': i,
        'data-locked': item.locked ? 'true' : undefined,
        'data-selected': isSelected ? 'true' : undefined,
        onPointerDown: (e) => drag.rowProps(item.id, i).onPointerDown(e),
      },
    };
  });

  return (
    <ItemList
      rows={rows}
      className={className}
      empty={empty}
      ref={drag.containerProps.ref}
      selection="multi"
      onActivate={(id, _i, mods) => press(id, mods)}
      onSelectRange={selectRange}
      onNudge={drag.nudge}
      containerProps={{ 'aria-label': 'Layers' }}
      dropIndex={drag.state.targetIndex}
    />
  );
}
