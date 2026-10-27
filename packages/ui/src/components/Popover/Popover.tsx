import { forwardRef, useCallback, useMemo, useRef } from 'react';
import { mergeRefs, useUNSAFE_PortalContext } from 'react-aria';
import { Popover as RACPopover, type PopoverProps as RACPopoverProps } from 'react-aria-components';
import { targetInBlockUnits } from '../../overlays/blockFrame';
import { overlayFrameFor, targetInFrame } from '../../overlays/overlayFrame';

/** Props for {@link Popover}: React Aria's, unchanged. */
export type PopoverProps = RACPopoverProps;

/**
 * React Aria's `Popover`, placed correctly inside a box drawn at another size.
 *
 * React Aria measures in client px and writes the popover's `top` and `left` in px of its containing block. Under
 * a `transform: scale(f)` or a `zoom` above that block the two differ by `f`. Inside such a box the popover is
 * placed in an overlay frame (`overlays/overlayFrame.ts`) that hands React Aria the trigger and the viewport both
 * in the box's own px, so the popover sits against its trigger, flips, shifts and limits its height against the
 * viewport as it would at 1×, and is drawn at the box's scale.
 *
 * Every weasel popover is one of these; use it in place of React Aria's for the same reason. A
 * `getTargetRect` of the caller's is read first and converted the same way, and so is a `boundaryElement`'s
 * absence: one of the caller's is used as given. React Aria's own fallback to an opening point, used only by its
 * preview trigger, is not kept.
 */
export const Popover = forwardRef<HTMLElement, PopoverProps>(function Popover(
  { getTargetRect, UNSTABLE_portalContainer, boundaryElement, ...props },
  ref,
) {
  const own = useRef<HTMLElement | null>(null);
  const { getContainer } = useUNSAFE_PortalContext();
  const container = UNSTABLE_portalContainer ?? getContainer?.() ?? null;
  const frame = useMemo(() => overlayFrameFor(container), [container]);
  const targetRect = useCallback(
    (target: Element) => {
      const rect = getTargetRect?.(target) ?? target.getBoundingClientRect();
      return frame ? targetInFrame(rect, target, frame) : targetInBlockUnits(rect, own.current);
    },
    [getTargetRect, frame],
  );
  const merged = useMemo(() => mergeRefs(own, ref), [ref]);
  return (
    <RACPopover
      {...props}
      ref={merged}
      UNSTABLE_portalContainer={frame ?? UNSTABLE_portalContainer}
      boundaryElement={boundaryElement ?? frame ?? undefined}
      getTargetRect={targetRect}
    />
  );
});
