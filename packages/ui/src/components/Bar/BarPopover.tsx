import type { ReactNode } from 'react';
import {
  Button as RACButton,
  Dialog as RACDialog,
  DialogTrigger,
  Popover as RACPopover,
} from 'react-aria-components';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { Caret } from '../Caret';
import f from '../field.module.css';
import listbox from '../listbox.module.css';
import s from './Bar.module.css';

/** Props for {@link BarPopover}. */
export interface BarPopoverProps extends OverlayPortalProps {
  /** What the button reads, and what names the popover. */
  label: string;
  /** A glyph before the label. */
  icon?: ReactNode;
  /** What the popover holds. */
  children: ReactNode;
  /** The button is dimmed and opens nothing. */
  isDisabled?: boolean;
  className?: string;
}

/**
 * A bar's cell for what one line cannot hold: a button reading a name, and a
 * popover under it holding the thing itself. A leaf whose value is made of
 * others draws this way in a bar, and so does a text area.
 */
export function BarPopover({ label, icon, children, isDisabled, className, portalContainer }: BarPopoverProps) {
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  return (
    <DialogTrigger>
      {anchor}
      <RACButton isDisabled={isDisabled} className={[f.frame, s.popTrigger, className].filter(Boolean).join(' ')}>
        {icon}
        <span>{label}</span>
        <Caret className={s.caret} />
      </RACButton>
      {/* `data-weasel-overlay`: see Select — the popover renders in a portal,
          outside the subtree the trigger sits in. */}
      {ready && provide(
        <RACPopover className={s.popover} data-weasel-overlay="">
          <RACDialog className={`${listbox.surface} ${s.popBody}`} aria-label={label}>
            {children}
          </RACDialog>
        </RACPopover>
      )}
    </DialogTrigger>
  );
}
