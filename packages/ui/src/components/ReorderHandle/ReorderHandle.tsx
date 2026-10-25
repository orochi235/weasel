import { useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from 'react';
import { assignRef } from '@weasel-js/react';
import { nudgeOf } from '../../nudgeKey';
import { DragGrip } from '../DragGrip';
import s from './ReorderHandle.module.css';

/** Props for {@link ReorderHandle}. */
export interface ReorderHandleProps {
  /** What the item is called; the handle is named "Drag to reorder <label>". */
  label: string;
  onPointerDown?: ((e: PointerEvent) => void) | undefined;
  /** Alt+Up (`-1`) or Alt+Down (`1`) on the handle. Return `true` when the item moved, and focus follows the handle. Unset, the keys are left to an ancestor. */
  onNudge?: ((delta: -1 | 1) => boolean | void) | undefined;
  /** Drawn in place of the grip. */
  badge?: ReactNode | undefined;
  /** The grip's height in px. Default 13. */
  size?: number;
  disabled?: boolean;
  /** The owner's sizing and placement. */
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** The button a reorderable item is dragged by, which Alt+Up/Down also move it from. */
export function ReorderHandle({ label, onPointerDown, onNudge, badge, size = 13, disabled = false, className, ref }: ReorderHandleProps) {
  const button = useRef<HTMLButtonElement | null>(null);
  const refocus = useRef(false);

  // A browser drops focus from a node the reorder moves in the DOM.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  });

  const onKeyDown = onNudge
    ? (e: KeyboardEvent) => {
        const delta = nudgeOf(e);
        if (delta === null) return;
        e.preventDefault();
        if (onNudge(delta) === true) refocus.current = true;
      }
    : undefined;

  return (
    <button
      ref={(el) => {
        button.current = el;
        assignRef(ref, el);
      }}
      type="button"
      className={[s.handle, className].filter(Boolean).join(' ')}
      aria-label={`Drag to reorder ${label}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      disabled={disabled}
      onPointerDown={disabled ? undefined : onPointerDown}
      onKeyDown={onKeyDown}
    >
      {badge ?? <DragGrip size={size} />}
    </button>
  );
}
