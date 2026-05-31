import { NumberField as BaseNumberField } from '@base-ui-components/react/number-field';
import type { ComponentProps } from 'react';
import { cn } from './cn';

export function NumberField({
  className,
  ...rest
}: ComponentProps<typeof BaseNumberField.Root>) {
  return (
    <BaseNumberField.Root className={className} {...rest}>
      <BaseNumberField.Group className={cn('lk-number-field')}>
        <BaseNumberField.Decrement className="lk-number-field__button">−</BaseNumberField.Decrement>
        <BaseNumberField.Input className="lk-number-field__input" />
        <BaseNumberField.Increment className="lk-number-field__button">+</BaseNumberField.Increment>
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  );
}
