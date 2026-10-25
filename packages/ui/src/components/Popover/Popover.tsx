import { forwardRef, useCallback, useMemo, useRef } from 'react';
import { mergeRefs } from 'react-aria';
import { Popover as RACPopover, type PopoverProps as RACPopoverProps } from 'react-aria-components';
import { blockFrame, containingBlock, inBlockUnits } from '../../overlays/blockFrame';

/** Props for {@link Popover}: React Aria's, unchanged. */
export type PopoverProps = RACPopoverProps;

/**
 * React Aria's `Popover`, placed correctly inside a box drawn at another size.
 *
 * React Aria measures the trigger in client px and writes the result as the popover's `top` and `left`, which are
 * px of its containing block. Under a `transform: scale(f)` or a `zoom` above that block the two differ by `f`,
 * and the popover lands `f` times its offset from the block's corner. This hands React Aria the trigger's rect in
 * the block's own px, so the popover sits against its trigger at any scale, and is drawn at that scale with it.
 *
 * Every weasel popover is one of these; use it in place of React Aria's for the same reason. A
 * `getTargetRect` of the caller's is read first and converted the same way. React Aria's own
 * fallback to an opening point, used only by its preview trigger, is not kept.
 */
export const Popover = forwardRef<HTMLElement, PopoverProps>(function Popover({ getTargetRect, ...props }, ref) {
  const own = useRef<HTMLElement | null>(null);
  const targetRect = useCallback(
    (target: Element) => {
      const rect = getTargetRect?.(target) ?? target.getBoundingClientRect();
      const overlay = own.current;
      return overlay ? inBlockUnits(rect, blockFrame(containingBlock(overlay))) : rect;
    },
    [getTargetRect],
  );
  const merged = useMemo(() => mergeRefs(own, ref), [ref]);
  return <RACPopover {...props} ref={merged} getTargetRect={targetRect} />;
});
