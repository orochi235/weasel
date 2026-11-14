import type { ReactElement, RefObject } from 'react';
import { Popover, PopoverDialog } from '../Popover';
import { PaintInput, type PaintInputProps } from '../PaintInput';
import s from './PaintField.module.css';

/** Props for {@link PaintEditorPopover}: the editor's, plus the popover's open state when no `DialogTrigger`
 *  owns it. */
export interface PaintEditorPopoverProps extends Omit<PaintInputProps, 'className' | 'subject'> {
  /** The element it opens under, for a popover outside a `DialogTrigger`. */
  triggerRef?: RefObject<Element | null>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A whole paint's editor in a popover: what `PaintField` and each `FillStrokeSwatch` chip open. Render it through
 * the `provide` of the opener's `useOverlayPortal`.
 */
export function PaintEditorPopover(props: PaintEditorPopoverProps): ReactElement {
  const { triggerRef, isOpen, onOpenChange, ...input } = props;
  const ariaLabel = input['aria-label'];
  const own = {
    ...(triggerRef ? { triggerRef } : {}),
    ...(isOpen !== undefined ? { isOpen } : {}),
    ...(onOpenChange ? { onOpenChange } : {}),
  };
  return (
    // `data-weasel-overlay`: see Select — the popover renders in a portal, outside the subtree its opener sits in.
    <Popover className={s.popover} data-weasel-overlay="" {...own}>
      <PopoverDialog className={s.body} aria-label={ariaLabel ? `${ariaLabel} editor` : 'Paint editor'}>
        <PaintInput {...input} />
      </PopoverDialog>
    </Popover>
  );
}
