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

/** Props for {@link Tabs}, on top of React Aria's `Tabs` props. */
export type TabsProps = Omit<RACTabsProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * Tab set wrapping React Aria's Tabs, skinned against the `--wzl-*` tokens.
 * Holds a {@link TabList} and one {@link TabPanel} per tab.
 */
export function Tabs({ children, className, ...rest }: TabsProps) {
  return (
    <RACTabs {...rest} className={[s.tabs, className].filter(Boolean).join(' ')}>
      {children}
    </RACTabs>
  );
}

/** Props for {@link TabList}, on top of React Aria's `TabList` props. */
export type TabListProps<T extends object> = Omit<RACTabListProps<T>, 'className'> & {
  className?: string;
};

/** The row of tab buttons inside a {@link Tabs}. */
export function TabList<T extends object>({ className, ...rest }: TabListProps<T>) {
  return <RACTabList<T> {...rest} className={[s.list, className].filter(Boolean).join(' ')} />;
}

/** Props for {@link Tab}, on top of React Aria's `Tab` props. */
export type TabProps = Omit<RACTabProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

/** One tab button. Its `id` selects the {@link TabPanel} it reveals. */
export function Tab({ children, className, ...rest }: TabProps) {
  return (
    <RACTab {...rest} className={[s.tab, className].filter(Boolean).join(' ')}>
      {children}
    </RACTab>
  );
}

/** Props for {@link TabPanel}, on top of React Aria's `TabPanel` props. */
export type TabPanelProps = Omit<RACTabPanelProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

/** The content shown for the {@link Tab} whose `id` matches this panel's. */
export function TabPanel({ children, className, ...rest }: TabPanelProps) {
  return (
    <RACTabPanel {...rest} className={[s.panel, className].filter(Boolean).join(' ')}>
      {children}
    </RACTabPanel>
  );
}
