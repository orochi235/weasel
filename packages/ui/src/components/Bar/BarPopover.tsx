import type { ReactNode } from 'react';
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
import { RunScope, useRun } from '../Run';
import { PopFace, popIconAttr } from './popFace';
import s from './Bar.module.css';
import { holdScope, type HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';

/** Props for {@link BarPopover}. */
export interface BarPopoverProps extends OverlayPortalProps, HoldProps {
  /** What the button reads, and what names the popover. */
  label: string;
  /** A glyph before the label. */
  icon?: ReactNode;
  /** What the popover holds. */
  children: ReactNode;
  className?: string;
}

/**
 * A bar's cell for what one line cannot hold: a button reading a name, and a
 * popover under it holding the thing itself. A leaf whose value is made of
 * others draws this way in a bar, and so does a text area. Disabled, its button opens nothing; read-only, it
 * opens on controls that refuse changes.
 */
export function BarPopover(props: BarPopoverProps) {
  const { label, icon, children, className, portalContainer } = props;
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const hold = useRacHold(props);
  const off = hold.access.state === 'disabled';
  const { side } = useRun();
  return hold.wrap(
    <DialogTrigger {...(off ? { isOpen: false } : {})}>
      {anchor}
      <RACButton
        isDisabled={hold.rac.isDisabled}
        aria-describedby={hold.rac['aria-describedby']}
        {...(off && hold.access.reachable ? { 'data-held': 'disabled' } : {})}
        className={[f.frame, s.popTrigger, className].filter(Boolean).join(' ')} {...popIconAttr(icon)}>
        <PopFace icon={icon} label={label} />
      </RACButton>
      {/* `data-weasel-overlay`: see Select — the popover renders in a portal,
          outside the subtree the trigger sits in. */}
      {ready && holdScope(props, provide(
        <Popover className={s.popover} {...(side ? { placement: side } : {})} data-weasel-overlay="">
          <RACDialog className={`${listbox.surface} ${s.popBody}`} aria-label={label}>
            {/* Context crosses the portal, and the bar's run is not the run of what opens from it. */}
            <RunScope fresh><BarMarkContext.Provider value={false}>{children}</BarMarkContext.Provider></RunScope>
          </RACDialog>
        </Popover>,
      ))}
    </DialogTrigger>,
  );
}
