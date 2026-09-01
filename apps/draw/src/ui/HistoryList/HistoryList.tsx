import type { ReactNode } from 'react';
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
    className: i === currentIndex ? s.current : undefined,
    rowProps: { 'data-row-index': i, onClick: () => onJump(i) },
  }));
  return <ItemList rows={rows} className={className} empty={empty} />;
}
