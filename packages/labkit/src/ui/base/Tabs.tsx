import { Tabs as BaseTabs } from '@base-ui-components/react/tabs';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function List({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseTabs.List>>) {
  return (
    <BaseTabs.List className={cn('lk-tabs__list', className)} {...rest}>
      {children}
      <BaseTabs.Indicator className="lk-tabs__indicator" />
    </BaseTabs.List>
  );
}

function Tab({ className, ...rest }: Override<ComponentProps<typeof BaseTabs.Tab>>) {
  return <BaseTabs.Tab className={cn('lk-tabs__tab', className)} {...rest} />;
}

function Panel({ className, ...rest }: Override<ComponentProps<typeof BaseTabs.Panel>>) {
  return <BaseTabs.Panel className={cn('lk-tabs__panel', className)} {...rest} />;
}

export const Tabs = {
  Root: BaseTabs.Root,
  List,
  Tab,
  Panel,
};
