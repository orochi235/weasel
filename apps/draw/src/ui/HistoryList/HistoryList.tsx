import type { ReactNode } from 'react';
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
  if (items.length === 0) {
    return (
      <div className={[s.list, className].filter(Boolean).join(' ')}>
        <div className={s.empty}>{empty ?? '—'}</div>
      </div>
    );
  }
  return (
    <div className={[s.list, className].filter(Boolean).join(' ')}>
      {items.map((item, i) => {
        const applied = i <= currentIndex;
        const current = i === currentIndex;
        const cls = [
          s.row,
          applied && s.applied,
          !applied && s.future,
          current && s.current,
        ].filter(Boolean).join(' ');
        return (
          <div
            key={item.id}
            data-row-index={i}
            className={cls}
            onClick={() => onJump(i)}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
