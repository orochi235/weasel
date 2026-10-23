import { createContext, useContext, useMemo, type ReactNode, type Ref } from 'react';
import {
  Tabs as RACTabs,
  TabList as RACTabList,
  Tab as RACTab,
  TabPanel as RACTabPanel,
  type TabsProps as RACTabsProps,
  type TabListProps as RACTabListProps,
  type TabProps as RACTabProps,
  type TabPanelProps as RACTabPanelProps,
  TabListStateContext,
} from 'react-aria-components';
import { useTrackShape } from '../Along/alongContext';
import { createRunSlots, slotClass, useRunSlot, type RunSlots } from '../Along/runSlots';
import { TabListAlong } from './TabListAlong';
import s from './Tabs.module.css';

/** The channel a tab list laid along a run hands its tabs their places on. A component that lays tabs along a run
 *  itself, like `PageTabs`, provides a held one above its `Tabs`, and the tab list inside joins it. */
export const TabSlotsContext = createContext<RunSlots | null>(null);

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
  const outer = useContext(TabSlotsContext);
  const own = useMemo(() => createRunSlots(), []);
  return (
    <TabSlotsContext.Provider value={outer?.held ? outer : own}>
      <RACTabs {...rest} className={[s.tabs, className].filter(Boolean).join(' ')}>
        {children}
      </RACTabs>
    </TabSlotsContext.Provider>
  );
}

/** Props for {@link TabList}, on top of React Aria's `TabList` props. */
export type TabListProps<T extends object> = Omit<RACTabListProps<T>, 'className'> & {
  className?: string;
  ref?: Ref<HTMLDivElement>;
};

/**
 * The row of tab buttons inside a {@link Tabs}. Inside an `Along` with a curved shape its tabs lie along the shape in
 * reading order, each tipped to its spot, and the rule under them follows it on the inside of the bend; such tabs need
 * an `id`.
 */
export function TabList<T extends object>({ className, ...rest }: TabListProps<T>) {
  const along = useTrackShape();
  const slots = useContext(TabSlotsContext);
  // React Aria renders a tab list twice: once to collect its tabs, with no state, and once for real.
  const real = useContext(TabListStateContext) !== null;
  if (slots?.held) return <RACTabList<T> {...rest} className={[s.list, s.joined, className].filter(Boolean).join(' ')} />;
  if (real && slots !== null && along !== null && along.shape.kind !== 'line') {
    return <TabListAlong {...(rest as TabListProps<object>)} className={className} shape={along.shape} align={along.align} slots={slots} />;
  }
  return <RACTabList<T> {...rest} className={[s.list, className].filter(Boolean).join(' ')} />;
}

/** Props for {@link Tab}, on top of React Aria's `Tab` props. */
export type TabProps = Omit<RACTabProps, 'className' | 'children'> & {
  children?: ReactNode;
  className?: string;
};

/** One tab button. Its `id` selects the {@link TabPanel} it reveals. */
export function Tab({ children, className, ...rest }: TabProps) {
  const slot = useRunSlot(TabSlotsContext, rest.id === undefined ? undefined : String(rest.id));
  if (slot === undefined) {
    return (
      <RACTab {...rest} className={[s.tab, className].filter(Boolean).join(' ')}>
        {children}
      </RACTab>
    );
  }
  const { className: _, style, ...at } = slot;
  return (
    <RACTab {...rest} {...at} className={slotClass(slot, [s.tab, className].filter(Boolean).join(' '))} style={{ ...(typeof rest.style === 'object' ? rest.style : null), ...style }}>
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
      <TabSlotsContext.Provider value={null}>{children}</TabSlotsContext.Provider>
    </RACTabPanel>
  );
}
