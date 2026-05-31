import { Popover as BasePopover } from '@base-ui-components/react/popover';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function Popup({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BasePopover.Popup>>) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={8}>
        <BasePopover.Popup className={cn('lk-popup', className)} {...rest}>
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export const Popover = {
  Root: BasePopover.Root,
  Trigger: BasePopover.Trigger,
  Close: BasePopover.Close,
  Title: BasePopover.Title,
  Description: BasePopover.Description,
  Popup,
};
