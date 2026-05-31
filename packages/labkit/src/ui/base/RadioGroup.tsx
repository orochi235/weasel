import { Radio } from '@base-ui-components/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui-components/react/radio-group';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function Root({ className, ...rest }: Override<ComponentProps<typeof BaseRadioGroup>>) {
  return <BaseRadioGroup className={cn('lk-radio-group', className)} {...rest} />;
}

type RadioItemProps = Override<ComponentProps<typeof Radio.Root>> & { children?: ReactNode };

function Item({ className, children, value, ...rest }: RadioItemProps) {
  return (
    <label className="lk-radio-item">
      <Radio.Root className={cn('lk-radio', className)} value={value} {...rest}>
        <Radio.Indicator className="lk-radio__indicator" />
      </Radio.Root>
      {children}
    </label>
  );
}

export const RadioGroup = { Root, Item };
