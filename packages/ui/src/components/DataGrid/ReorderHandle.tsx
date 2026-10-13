import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import s from './DataGrid.module.css';

interface ReorderHandleProps {
  /** What the row is called; the handle is named "Reorder <label>". */
  label: string;
  onPointerDown: (e: PointerEvent) => void;
  /** Move the row one place; `true` when it moved. */
  onNudge: (delta: -1 | 1) => boolean;
}

/** A {@link DataGrid} row's leading cell: a button that drags the row, and moves it with Alt+ArrowUp/Down. */
export function ReorderHandle({ label, onPointerDown, onNudge }: ReorderHandleProps) {
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  // A browser drops focus from a node the reorder moves in the DOM.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    if (onNudge(e.key === 'ArrowDown' ? 1 : -1)) refocus.current = true;
  };

  return (
    <td className={s.handleCell}>
      <button
        ref={button}
        type="button"
        className={s.handle}
        aria-label={`Reorder ${label}`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
    </td>
  );
}
