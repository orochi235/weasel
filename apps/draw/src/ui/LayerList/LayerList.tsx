import type { ReactNode, CSSProperties } from 'react';
import { useCallback, useRef } from 'react';
import { ItemList, useReorderDragList, type ItemListRow, type LayerListItem } from '@weasel-js/ui';
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

  const drag = useReorderDragList({
    items,
    selectedIds,
    onReorder,
    // The drop indicator is a child of the list too, ahead of the rows.
    rowSelector: '[data-row-index]',
    onPress: (id, mods) => {
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
    },
  });

  const listRef = useRef<HTMLDivElement | null>(null);
  const dragRef = drag.containerProps.ref as React.RefCallback<HTMLDivElement>;
  const setListRef = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    dragRef(el);
  }, [dragRef]);

  const rows: ItemListRow[] = items.map((item, i) => {
    const isSelected = selectedIds.includes(item.id);
    return {
      id: item.id,
      label: item.label,
      selected: isSelected,
      className: (drag.state.draggedIds?.includes(item.id) ?? false) ? s.dragging : undefined,
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
      ref={setListRef}
      overlay={drag.state.targetIndex !== null
        // Pixel positioning: the offset depends on the measured rows at
        // runtime, so it cannot be a static class.
        ? <div className={s.dropIndicator} style={dropIndicatorStyle(listRef.current, drag.state.targetIndex)} />
        : undefined}
    />
  );
}

/** The seam above row `targetIndex` (or below the last row), measured from
 *  the rendered rows so it tracks whatever height the density gives them. */
function dropIndicatorStyle(list: HTMLElement | null, targetIndex: number): CSSProperties {
  const rows = list?.querySelectorAll<HTMLElement>('[data-row-index]') ?? [];
  if (rows.length === 0) return { top: '0px' };
  const bottomOf = (el: HTMLElement) => el.offsetTop + el.offsetHeight;
  let y: number;
  if (targetIndex <= 0) y = rows[0].offsetTop;
  else if (targetIndex >= rows.length) y = bottomOf(rows[rows.length - 1]);
  else y = (bottomOf(rows[targetIndex - 1]) + rows[targetIndex].offsetTop) / 2;
  // Center the indicator's own thickness on the seam.
  return { top: `${y - 1}px` };
}
