import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ItemList, type ItemListRow } from '@weasel-js/ui';
import s from './HistoryList.module.css';

/** A single row in the history panel. Mirrors `weasel-kit`'s
 *  `HistoryEntry` plus a synthetic id for the "Initial" row at the top,
 *  which lives outside the kit's history but lets users fully unwind. */
export interface HistoryListItem {
  /** Stable identity for React keys. Use a string so the synthetic
   *  `__initial__` row can sit next to numeric history ids. */
  id: string;
  label: ReactNode;
}

export interface HistoryListProps {
  items: HistoryListItem[];
  /** Index of the "current state" marker — entries with index < current
   *  are on the undo stack (applied), entries with index ≥ current are
   *  on the redo stack (not yet re-applied). The synthetic Initial row
   *  sits at index 0; the first real history entry at index 1; etc.
   *  So `currentIndex === 0` means "nothing applied" (Initial selected). */
  currentIndex: number;
  onJump(index: number): void;
  className?: string;
  empty?: ReactNode;
}

/** Photoshop-style history list. Oldest on top, newest on bottom.
 *  Entries above (and including) `currentIndex` are styled as applied;
 *  entries below are dimmed to indicate they're redo-able. The current
 *  row gets a stronger highlight; an inset border below the current row
 *  signals the divider between undo and redo. */
export function HistoryList(props: HistoryListProps) {
  const { items, currentIndex, onJump, className, empty } = props;
  const rows: ItemListRow[] = items.map((item, i) => ({
    id: item.id,
    label: item.label,
    // Everything at or before the marker has been applied; what follows is
    // redoable, so it reads as present but not in effect.
    muted: i > currentIndex,
    selected: i === currentIndex,
    className: i === currentIndex ? `${s.row} ${s.current}` : s.row,
    rowProps: { 'data-row-index': i },
  }));
  const scroller = useRef<HTMLDivElement>(null);
  // Scrolls only the list's own box: `scrollIntoView` would also scroll
  // every scrollable ancestor, the window included.
  useLayoutEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>(`[data-row-index="${currentIndex}"]`);
    if (!box || !row) return;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight;
  }, [currentIndex, items.length]);
  return (
    <div ref={scroller} className={s.scroller}>
      <ItemList
        rows={rows}
        className={className}
        empty={empty}
        selection="single"
        onActivate={(_id, i) => onJump(i)}
        containerProps={{ 'aria-label': 'History' }}
      />
    </div>
  );
}
