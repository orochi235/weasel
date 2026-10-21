import type { ReactNode } from 'react';
import { Button as RACButton, Dialog as RACDialog, DialogTrigger, Popover as RACPopover } from 'react-aria-components';
import { Icon } from '../../icons/Icon';
import { useOverlayPortal } from '../../overlays/portalHost';
import listbox from '../listbox.module.css';
import type { BarSide } from './barSide';
import s from './Bar.module.css';
import { icon } from '../../icons.gen';

/** The button at the end of a bar that opens the cells its line had no room for, one under another. A curved bar gives it the `side` its popover opens on. */
export function BarOverflow({ label, children, side }: { label: string; children: ReactNode; side?: BarSide }) {
  const { anchor, provide, ready } = useOverlayPortal();
  return (
    <DialogTrigger>
      {anchor}
      <RACButton aria-label={label} className={s.action}>
        <Icon name={icon('more')} size={16} />
      </RACButton>
      {ready && provide(
        <RACPopover className={s.popover} {...(side ? { placement: side } : {})} data-weasel-overlay="">
          <RACDialog className={`${listbox.surface} ${s.menu}`} aria-label={label}>
            {children}
          </RACDialog>
        </RACPopover>
      )}
    </DialogTrigger>
  );
}
