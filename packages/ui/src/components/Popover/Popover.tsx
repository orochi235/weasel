import { forwardRef, useCallback, useMemo, useRef } from 'react';
import { mergeRefs } from 'react-aria';
import { Popover as RACPopover, type PopoverProps as RACPopoverProps } from 'react-aria-components';
import { targetInBlockUnits } from '../../overlays/blockFrame';
import { frameBoundary, overlayFrameFor, targetInFrame } from '../../overlays/overlayFrame';
import { useReactAriaPortalTarget, withPortalTarget } from '../../overlays/portalHost';

/** Props for {@link Popover}: React Aria's, unchanged. */
export type PopoverProps = RACPopoverProps;

/**
 * React Aria's `Popover`, placed correctly inside a positioned container and inside a box drawn at another size.
 *
 * Portaled into a positioned container, React Aria shifts a popover sideways as though the viewport's corner sat at
 * the container's. Under a `transform: scale(f)` or a `zoom` it also measures in client px while writing the
 * popover's `top` and `left` in px of its containing block, which differ by `f`. In either case the popover is
 * placed in an overlay frame (`overlays/overlayFrame.ts`) that hands React Aria the trigger and the viewport both
 * in the container's own px, so the popover sits against its trigger, flips, shifts and limits its height against
 * the viewport as it would at 1× from the body, and is drawn at the container's scale.
 *
 * Every weasel popover is one of these; use it in place of React Aria's for the same reason. A
 * `getTargetRect` of the caller's is read first and converted the same way, and so is a `boundaryElement`'s
 * absence: one of the caller's is used as given. React Aria's own fallback to an opening point, used only by its
 * preview trigger, is not kept.
 */
export const Popover = forwardRef<HTMLElement, PopoverProps>(function Popover(
  { getTargetRect, boundaryElement, ...props },
  ref,
) {
  const own = useRef<HTMLElement | null>(null);
  const container = useReactAriaPortalTarget(props);
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
      {...withPortalTarget(props, frame)}
      ref={merged}
      boundaryElement={boundaryElement ?? (frame ? frameBoundary(frame) : undefined)}
      getTargetRect={targetRect}
    />
  );
});
