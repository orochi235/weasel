import { Select as BaseSelect } from '@base-ui-components/react/select';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type Override<T, K extends keyof T = never> = Omit<T, 'className' | K> & { className?: string };

function Trigger({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseSelect.Trigger>>) {
  return (
    <BaseSelect.Trigger className={cn('lk-trigger', className)} {...rest}>
      {children ?? (
        <>
          <BaseSelect.Value />
          <BaseSelect.Icon className="lk-trigger__caret">▾</BaseSelect.Icon>
        </>
      )}
    </BaseSelect.Trigger>
  );
}

function Popup({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseSelect.Popup>>) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={6}>
        <BaseSelect.Popup className={cn('lk-popup', className)} {...rest}>
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

function Item({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseSelect.Item>> & { children?: ReactNode }) {
  return (
    <BaseSelect.Item className={cn('lk-popup__item', className)} {...rest}>
      <BaseSelect.ItemIndicator className="lk-popup__item-indicator">●</BaseSelect.ItemIndicator>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

function Separator({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('lk-popup__separator', className)} role="separator" {...rest} />;
}

function GroupLabel({
  className,
  ...rest
}: Override<ComponentProps<typeof BaseSelect.GroupLabel>>) {
  return <BaseSelect.GroupLabel className={cn('lk-popup__group-label', className)} {...rest} />;
}

export const Select = {
  Root: BaseSelect.Root,
  Value: BaseSelect.Value,
  Group: BaseSelect.Group,
  Trigger,
  Popup,
  Item,
  Separator,
  GroupLabel,
};
