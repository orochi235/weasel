import { useContext, type ReactNode } from 'react';
import {
  Button as RACButton,
  Dialog as RACDialog,
  DialogTrigger,
} from 'react-aria-components';
import { Popover } from '../Popover';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import f from '../field.module.css';
import listbox from '../listbox.module.css';
import { BarMarkContext } from './barOrder';
import { BarSideContext } from './barSide';
import { OrientationContext } from '../orientation';
import { PopFace, popIconAttr } from './popFace';
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
  const side = useContext(BarSideContext);
  return (
    <DialogTrigger>
      {anchor}
      <RACButton isDisabled={isDisabled} className={[f.frame, s.popTrigger, className].filter(Boolean).join(' ')} {...popIconAttr(icon)}>
        <PopFace icon={icon} label={label} />
      </RACButton>
      {/* `data-weasel-overlay`: see Select — the popover renders in a portal,
          outside the subtree the trigger sits in. */}
      {ready && provide(
        <Popover className={s.popover} {...(side ? { placement: side } : {})} data-weasel-overlay="">
          <RACDialog className={`${listbox.surface} ${s.popBody}`} aria-label={label}>
            {/* Context crosses the portal, and a side belongs to the curved bar's line, not to what opens from it. */}
            <OrientationContext.Provider value="horizontal"><BarSideContext.Provider value={undefined}><BarMarkContext.Provider value={false}>{children}</BarMarkContext.Provider></BarSideContext.Provider></OrientationContext.Provider>
          </RACDialog>
        </Popover>
      )}
    </DialogTrigger>
  );
}
