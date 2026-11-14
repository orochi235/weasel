import { forwardRef, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from 'react';
import { assignRef } from '@weasel-js/react';
import { nudgeOf } from '@weasel-js/ui-input';
import { DragGrip } from '../DragGrip';
import s from './ReorderHandle.module.css';
import { useDisabled, type DisableableProps } from '../Disabled';
import { useHoldReason } from '../Disabled/HoldReason';

/** Props for {@link ReorderHandle}. */
export interface ReorderHandleProps extends DisableableProps {
  /** What the item is called; the handle is named "Drag to reorder <label>". */
  label: string;
  onPointerDown?: ((e: PointerEvent) => void) | undefined;
  /** A press from the keyboard, Enter or Space; a pointer press reaches its owner through the drag's `onPress`. */
  onClick?: (() => void) | undefined;
  /** Whether what the handle selects is selected, read as a toggle's state. Unset, the handle is no toggle. */
  pressed?: boolean | undefined;
  /** Alt+Up (`-1`) or Alt+Down (`1`) on the handle. Return `true` when the item moved, and focus follows the handle. Unset, the keys are left to an ancestor. */
  onNudge?: ((delta: -1 | 1) => boolean | void) | undefined;
  /** Drawn in place of the grip. */
  badge?: ReactNode | undefined;
  /** The grip's height in px. Default 13. */
  size?: number;
  /** The owner's sizing and placement. */
  className?: string;
}

/** The button a reorderable item is dragged by, which Alt+Up/Down also move it from. */
export const ReorderHandle = forwardRef(function ReorderHandle(
  props: ReorderHandleProps,
  ref: Ref<HTMLButtonElement>,
) {
  const { label, onPointerDown, onClick, pressed, onNudge, badge, size = 13, className } = props;
  const { disabled, reason } = useDisabled(props);
  const why = useHoldReason(reason);
  const button = useRef<HTMLButtonElement | null>(null);
  const refocus = useRef(false);

  // A browser drops focus from a node the reorder moves in the DOM.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  });

  const onKeyDown = onNudge && !disabled
    ? (e: KeyboardEvent) => {
        const delta = nudgeOf(e);
        if (delta === null) return;
        e.preventDefault();
        if (onNudge(delta) === true) refocus.current = true;
      }
    : undefined;

  return why.wrap(
    <button
      ref={(el) => {
        button.current = el;
        assignRef(ref, el);
      }}
      type="button"
      className={[s.handle, className].filter(Boolean).join(' ')}
      aria-label={`Drag to reorder ${label}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      aria-pressed={pressed}
      disabled={disabled && reason === undefined}
      aria-disabled={(disabled && reason !== undefined) || undefined}
      aria-describedby={why.describedBy}
      onPointerDown={disabled ? undefined : onPointerDown}
      onKeyDown={onKeyDown}
      onClick={disabled ? undefined : onClick}
    >
      {badge ?? <DragGrip size={size} />}
    </button>,
  );
});
