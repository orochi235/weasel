import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function Popup({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseTooltip.Popup>>) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={6}>
        <BaseTooltip.Popup className={cn('lk-tooltip', className)} {...rest}>
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

export const Tooltip = {
  Provider: BaseTooltip.Provider,
  Root: BaseTooltip.Root,
  Trigger: BaseTooltip.Trigger,
  Popup,
};
