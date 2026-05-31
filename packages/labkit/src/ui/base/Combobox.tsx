import { Combobox as BaseCombobox } from '@base-ui-components/react/combobox';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function Input({ className, ...rest }: Override<ComponentProps<typeof BaseCombobox.Input>>) {
  return <BaseCombobox.Input className={cn('lk-trigger', className)} {...rest} />;
}

function Popup({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseCombobox.Popup>>) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner sideOffset={6}>
        <BaseCombobox.Popup className={cn('lk-popup', className)} {...rest}>
          {children}
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

function Item({ className, ...rest }: Override<ComponentProps<typeof BaseCombobox.Item>>) {
  return <BaseCombobox.Item className={cn('lk-popup__item', className)} {...rest} />;
}

function Empty({ className, ...rest }: Override<ComponentProps<typeof BaseCombobox.Empty>>) {
  return <BaseCombobox.Empty className={cn('lk-popup__group-label', className)} {...rest} />;
}

export const Combobox = {
  Root: BaseCombobox.Root,
  List: BaseCombobox.List,
  Input,
  Popup,
  Item,
  Empty,
};
