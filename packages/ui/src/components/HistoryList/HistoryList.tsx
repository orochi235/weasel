import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ItemList, type ItemListRow } from '../ItemList';
import s from './HistoryList.module.css';

/** One state the list can jump to. */
export interface HistoryListEntry {
  /** Stable identity, the row's React key. */
  id: string;
  label: ReactNode;
}

/** Props for {@link HistoryList}. */
export interface HistoryListProps {
  /** Every state, oldest first. A history whose base state has no entry of its
   *  own puts one first ("Initial"), so the list can unwind all the way. */
  entries: readonly HistoryListEntry[];
  /** Index into `entries` of the state in effect. Entries after it are
   *  redoable: present, but not applied. */
  current: number;
  /** A row was picked: go to the state at `index`. */
  onJump(index: number): void;
  /** Names the list. Default `'History'`. */
  'aria-label'?: string;
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
  /** Class on the outermost element, the scrolling box. */
  className?: string;
}

/**
 * An undo history as a list, oldest on top. The current state is selected and
 * rules a line under itself, and the redoable states after it are dimmed.
 * Picking a row, by click or Enter, jumps there.
 */
export function HistoryList({
  entries, current, onJump, 'aria-label': ariaLabel = 'History', empty, className,
}: HistoryListProps) {
  const rows: ItemListRow[] = entries.map((entry, i) => ({
    id: entry.id,
    label: entry.label,
    muted: i > current,
    selected: i === current,
    className: i === current ? `${s.row} ${s.current}` : s.row,
    rowProps: { 'data-row-index': i },
  }));
  const scroller = useRef<HTMLDivElement>(null);
  // Scrolls only the list's own box: `scrollIntoView` would also scroll
  // every scrollable ancestor, the window included.
  useLayoutEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>(`[data-row-index="${current}"]`);
    if (!box || !row) return;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight;
  }, [current, entries.length]);
  return (
    <div ref={scroller} className={className ? `${s.scroller} ${className}` : s.scroller}>
      <ItemList
        rows={rows}
        empty={empty}
        selection="single"
        onActivate={(_id, i) => onJump(i)}
        containerProps={{ 'aria-label': ariaLabel }}
      />
    </div>
  );
}
