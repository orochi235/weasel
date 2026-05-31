import { Switch as BaseSwitch } from '@base-ui-components/react/switch';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

export function Switch({ className, ...rest }: Override<ComponentProps<typeof BaseSwitch.Root>>) {
  return (
    <BaseSwitch.Root className={cn('lk-switch', className)} {...rest}>
      <BaseSwitch.Thumb className="lk-switch__thumb" />
    </BaseSwitch.Root>
  );
}
