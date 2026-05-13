import type { ReactNode, PointerEvent as ReactPointerEvent, CSSProperties } from 'react';
import { useRef } from 'react';
import { useReorderDragList, type LayerListItem } from '../../useReorderDragList';
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
  const drag = useReorderDragList({ items, selectedIds, onReorder });

  // Track whether the pointerdown will resolve as a click or a drag.
  // We read this on pointerup — before the hook resets — to decide if
  // onSelect should fire. A ref avoids stale-closure issues.
  const pendingClickRef = useRef<{ id: string; shift: boolean } | null>(null);
  // Keep selectedIds and callbacks in a ref so pointerup always sees the
  // current values regardless of when React flushes re-renders.
  const propsRef = useRef({ selectedIds, onSelect });
  propsRef.current = { selectedIds, onSelect };

  const handleRowPointerDown = (id: string, index: number, e: ReactPointerEvent) => {
    pendingClickRef.current = { id, shift: e.shiftKey };
    drag.rowProps(id, index).onPointerDown(e);
  };

  const handleContainerPointerUp = (e: ReactPointerEvent) => {
    const pending = pendingClickRef.current;
    // Read drag state BEFORE the hook resets it in onPointerUp.
    const wasDragging = drag.state.draggedIds !== null;
    drag.containerProps.onPointerUp(e);
    if (pending && !wasDragging) {
      const { selectedIds: sel, onSelect: sel_cb } = propsRef.current;
      const targetItem = items.find((it) => it.id === pending.id);
      if (targetItem?.locked) {
        // Locked rows are always exclusive — ignore shift modifier so they
        // never combine with other rows in a multi-selection.
        sel_cb([pending.id]);
      } else if (pending.shift) {
        // Strip any currently-selected locked ids before applying the toggle
        // so a leftover locked selection (e.g., Page) doesn't carry through
        // when the user starts building a multi-selection of regular rows.
        const lockedIds = new Set(items.filter((it) => it.locked).map((it) => it.id));
        const filtered = sel.filter((id) => !lockedIds.has(id));
        if (filtered.includes(pending.id)) {
          sel_cb(filtered.filter((x) => x !== pending.id));
        } else {
          sel_cb([...filtered, pending.id]);
        }
      } else {
        sel_cb([pending.id]);
      }
    }
    pendingClickRef.current = null;
  };

  if (items.length === 0) {
    return (
      <div className={[s.list, className].filter(Boolean).join(' ')}>
        <div className={s.empty}>{empty ?? '—'}</div>
      </div>
    );
  }

  return (
    <div
      className={[s.list, className].filter(Boolean).join(' ')}
      ref={drag.containerProps.ref as React.RefCallback<HTMLDivElement>}
      onPointerMove={drag.containerProps.onPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={drag.containerProps.onPointerCancel}
    >
      {items.map((item, i) => {
        const isSelected = selectedIds.includes(item.id);
        const isDragging = drag.state.draggedIds?.includes(item.id) ?? false;
        const cls = [s.row, isSelected && s.selected, isDragging && s.dragging]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={item.id}
            data-row-index={i}
            className={cls}
            onPointerDown={(e) => handleRowPointerDown(item.id, i, e)}
          >
            {item.label}
          </div>
        );
      })}
      {drag.state.targetIndex !== null && (
        // Dynamic pixel positioning for the drop indicator — cannot be expressed
        // as a static CSS class (offset depends on targetIndex at runtime).
        <div
          className={s.dropIndicator}
          style={dropIndicatorStyle(drag.state.targetIndex)}
        />
      )}
    </div>
  );
}

function dropIndicatorStyle(targetIndex: number): CSSProperties {
  // 28px row + 1px gap = 29px per row; container has 2px top padding.
  const ROW_H = 28;
  const GAP = 1;
  const PAD = 2;
  const y = PAD + targetIndex * (ROW_H + GAP) - GAP / 2;
  return { top: `${y}px` };
}
