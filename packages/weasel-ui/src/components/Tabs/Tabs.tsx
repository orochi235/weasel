import type { ReactNode } from 'react';
import {
  Tabs as RACTabs,
  TabList as RACTabList,
  Tab as RACTab,
  TabPanel as RACTabPanel,
  type TabsProps as RACTabsProps,
  type TabListProps as RACTabListProps,
  type TabProps as RACTabProps,
  type TabPanelProps as RACTabPanelProps,
} from 'react-aria-components';
import s from './Tabs.module.css';

export type TabsProps = Omit<RACTabsProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

export function Tabs({ children, className, ...rest }: TabsProps) {
  return (
    <RACTabs {...rest} className={[s.tabs, className].filter(Boolean).join(' ')}>
      {children}
    </RACTabs>
  );
}

export type TabListProps<T extends object> = Omit<RACTabListProps<T>, 'className'> & {
  className?: string;
};

export function TabList<T extends object>({ className, ...rest }: TabListProps<T>) {
  return <RACTabList<T> {...rest} className={[s.list, className].filter(Boolean).join(' ')} />;
}

export type TabProps = Omit<RACTabProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

export function Tab({ children, className, ...rest }: TabProps) {
  return (
    <RACTab {...rest} className={[s.tab, className].filter(Boolean).join(' ')}>
      {children}
    </RACTab>
  );
}

export type TabPanelProps = Omit<RACTabPanelProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

export function TabPanel({ children, className, ...rest }: TabPanelProps) {
  return (
    <RACTabPanel {...rest} className={[s.panel, className].filter(Boolean).join(' ')}>
      {children}
    </RACTabPanel>
  );
}
