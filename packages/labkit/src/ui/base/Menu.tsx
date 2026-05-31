import { Menu as BaseMenu } from '@base-ui-components/react/menu';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function Trigger({ className, ...rest }: Override<ComponentProps<typeof BaseMenu.Trigger>>) {
  return <BaseMenu.Trigger className={cn('lk-button', className)} {...rest} />;
}

function Popup({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseMenu.Popup>>) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={6}>
        <BaseMenu.Popup className={cn('lk-popup', className)} {...rest}>
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

function Item({ className, ...rest }: Override<ComponentProps<typeof BaseMenu.Item>>) {
  return <BaseMenu.Item className={cn('lk-popup__item', className)} {...rest} />;
}

function Separator({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('lk-popup__separator', className)} role="separator" {...rest} />;
}

function GroupLabel({
  className,
  ...rest
}: Override<ComponentProps<typeof BaseMenu.GroupLabel>>) {
  return <BaseMenu.GroupLabel className={cn('lk-popup__group-label', className)} {...rest} />;
}

export const Menu = {
  Root: BaseMenu.Root,
  Group: BaseMenu.Group,
  SubmenuRoot: BaseMenu.SubmenuRoot,
  SubmenuTrigger: BaseMenu.SubmenuTrigger,
  Trigger,
  Popup,
  Item,
  Separator,
  GroupLabel,
};
