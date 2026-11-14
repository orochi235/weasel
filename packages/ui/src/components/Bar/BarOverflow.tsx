import type { ReactNode } from 'react';
import { Button as RACButton, DialogTrigger } from 'react-aria-components';
import { Popover, PopoverDialog } from '../Popover';
import { Icon } from '../Icon/Icon';
import { useOverlayPortal } from '../../overlays/portalHost';
import { BarMarkContext } from './barOrder';
import { FormScope } from '../ActionButton/controlForm';
import a from '../ActionButton/ActionButton.module.css';
import type { BarSide } from './barSide';
import { RunScope } from '../Run';
import s from './Bar.module.css';
import { icon } from '../../icons.gen';

/** The button at the end of a bar that opens the cells its line had no room for, one under another. A curved bar gives it the `side` its popover opens on. */
export function BarOverflow({ label, children, side }: { label: string; children: ReactNode; side?: BarSide }) {
  const { anchor, provide, ready } = useOverlayPortal();
  return (
    <DialogTrigger>
      {anchor}
      <RACButton aria-label={label} className={a.action}>
        <Icon name={icon('more')} size={16} />
      </RACButton>
      {ready && provide(
        <Popover className={s.popover} {...(side ? { placement: side } : {})} data-weasel-overlay="">
          <PopoverDialog className={s.menu} aria-label={label}>
            <RunScope fresh><BarMarkContext.Provider value={false}><FormScope form="menu">{children}</FormScope></BarMarkContext.Provider></RunScope>
          </PopoverDialog>
        </Popover>
      )}
    </DialogTrigger>
  );
}
