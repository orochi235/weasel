import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Tooltip } from '../Tooltip';
import { useUntoldReason } from './Disabled';

const OPEN_DELAY = 600;

/** What {@link useHoldReason} gives a control held for a reason. */
export interface HoldReasonParts {
  /** The id to add to the control's `aria-describedby`, or undefined with no reason. */
  describedBy: string | undefined;
  /** Follows the control with the reason's description and tooltip, which pointing at the control or focusing it
   *  opens. With no reason it adds nothing, and either way the control keeps its place, so it is not remounted. */
  wrap(node: ReactNode): ReactNode;
}

/**
 * The tooltip and description a disabled or read-only control shows for its reason, for a control whose focus
 * target the kit does not draw itself, such as a React Aria field. The control is the element just before the
 * description.
 */
export function useHoldReason(held: string | undefined): HoldReasonParts {
  const reason = useUntoldReason(held);
  const id = `${useId()}-reason`;
  const note = useRef<HTMLSpanElement>(null);
  const target = useRef<Element | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = note.current?.previousElementSibling;
    if (!reason || !el) return;
    target.current = el;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (now: boolean) => () => {
      clearTimeout(timer);
      if (now) setOpen(true);
      else timer = setTimeout(() => setOpen(true), OPEN_DELAY);
    };
    const leave = (e: Event) => {
      if (el.contains((e as PointerEvent | FocusEvent).relatedTarget as Node | null)) return;
      clearTimeout(timer);
      setOpen(false);
    };
    const over = show(false);
    const focus = show(true);
    el.addEventListener('pointerover', over);
    el.addEventListener('pointerout', leave);
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', leave);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('pointerover', over);
      el.removeEventListener('pointerout', leave);
      el.removeEventListener('focusin', focus);
      el.removeEventListener('focusout', leave);
      setOpen(false);
    };
  }, [reason]);

  return {
    describedBy: reason ? id : undefined,
    wrap: (node) => (
      <>
        {node}
        {reason && <span ref={note} id={id} hidden>{reason}</span>}
        {reason && <Tooltip triggerRef={target as RefObject<Element>} isOpen={open} onOpenChange={setOpen}>{reason}</Tooltip>}
      </>
    ),
  };
}

/** Joins `aria-describedby` ids, leaving out the missing ones. */
export function describedBy(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined || undefined;
}
