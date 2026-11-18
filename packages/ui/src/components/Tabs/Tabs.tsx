import {
  createContext, forwardRef, useContext, useMemo, useRef, useState, type ContextType, type ReactElement, type ReactNode,
  type Ref, type RefAttributes,
} from 'react';
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
  type Key,
  type TabRenderProps,
} from 'react-aria-components';
import { freeKeyFrom, isHeldKey, StateProbe, useHeldAriaRef } from '../heldItem';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { useRun } from '../Run';
import { createRunSlots, slotClass, useRunSlot, type RunSlots } from '../Along/runSlots';
import { TabListAlong } from './TabListAlong';
import s from './Tabs.module.css';

/** The channel a tab list laid along a run hands its tabs their places on. A component that lays tabs along a run
 *  itself, like `PageTabs`, provides a held one above its `Tabs`, and the tab list inside joins it. */
export const TabSlotsContext = createContext<RunSlots | null>(null);

/** Props for {@link Tabs}, on top of React Aria's `Tabs` props. */
export type TabsProps = Omit<RACTabsProps, 'className' | 'children' | 'isDisabled'> & {
  children?: ReactNode;
  className?: string;
  /** No tab can be chosen. */
  disabled?: boolean;
};

/**
 * Tab set wrapping React Aria's Tabs, skinned against the `--wzl-*` tokens.
 * Holds a {@link TabList} and one {@link TabPanel} per tab. Tabs move between views rather than set a value, so a
 * `Disabled` scope around them leaves them usable, and every panel can still be read. The arrow keys land on a
 * disabled {@link Tab}, which shows its reason, and it is never chosen.
 */
export function Tabs({ children, className, disabled, selectedKey, defaultSelectedKey, onSelectionChange, ...rest }: TabsProps) {
  const outer = useContext(TabSlotsContext);
  const own = useMemo(() => createRunSlots(), []);
  // Held here, so a disabled tab focus lands on is refused rather than chosen: React Aria selects on focus.
  const [ownKey, setOwnKey] = useState<Key | null>(defaultSelectedKey ?? null);
  // Null until a tab is chosen, which React Aria reads as controlled and fills with its first tab, though its type
  // leaves null out.
  const shown = (selectedKey === undefined ? ownKey : selectedKey) as Key;
  const stateRef = useRef<ContextType<typeof TabListStateContext>>(null);
  const choose = (k: Key): void => {
    const coll = stateRef.current?.collection;
    const to = coll && isHeldKey(coll, k) ? (shown == null ? freeKeyFrom(coll, coll.getFirstKey(), 1) : null) : k;
    if (to === null) return;
    if (selectedKey === undefined) setOwnKey(to);
    onSelectionChange?.(to);
  };
  return (
    <TabSlotsContext.Provider value={outer?.held ? outer : own}>
      <RACTabs {...rest} selectedKey={shown} onSelectionChange={choose} isDisabled={disabled} className={[s.tabs, className].filter(Boolean).join(' ')}>
        <StateProbe context={TabListStateContext} intoRef={stateRef} />
        {children}
      </RACTabs>
    </TabSlotsContext.Provider>
  );
}

/** Props for {@link TabList}, on top of React Aria's `TabList` props. */
export type TabListProps<T extends object> = Omit<RACTabListProps<T>, 'className'> & {
  className?: string;
};

/**
 * The row of tab buttons inside a {@link Tabs}. Inside an `Along` with a curved shape its tabs lie along the shape in
 * reading order, each tipped to its spot, and the rule under them follows it on the inside of the bend; such tabs need
 * an `id`.
 */
export const TabList = forwardRef(function TabList<T extends object>(
  { className, ...rest }: TabListProps<T>,
  ref: Ref<HTMLDivElement>,
) {
  const enclosing = useRun();
  const slots = useContext(TabSlotsContext);
  // React Aria renders a tab list twice: once to collect its tabs, with no state, and once for real.
  const real = useContext(TabListStateContext) !== null;
  if (slots?.held) return <RACTabList<T> {...rest} ref={ref} className={[s.list, s.joined, className].filter(Boolean).join(' ')} />;
  if (real && slots !== null && enclosing.shape !== undefined && enclosing.shape.kind !== 'line') {
    return <TabListAlong {...(rest as TabListProps<object>)} ref={ref} className={className} shape={enclosing.shape} align={enclosing.align ?? 'center'} slots={slots} />;
  }
  return <RACTabList<T> {...rest} ref={ref} className={[s.list, className].filter(Boolean).join(' ')} />;
}) as <T extends object>(props: TabListProps<T> & RefAttributes<HTMLDivElement>) => ReactElement;

/** Props for {@link Tab}, on top of React Aria's `Tab` props. */
export type TabProps = Omit<RACTabProps, 'className' | 'children' | 'isDisabled'> & {
  children?: ReactNode;
  className?: string;
  /** The tab cannot be chosen. Arrow keys still land on it, as on a menu's or a listbox's disabled row. */
  disabled?: boolean;
  /** Why it cannot be chosen, shown while it has keyboard focus or the pointer is over it. */
  disabledReason?: string;
};

/** One tab button. Its `id` selects the {@link TabPanel} it reveals. */
export function Tab({ children, className, disabled, disabledReason, ...rest }: TabProps) {
  const slot = useRunSlot(TabSlotsContext, rest.id === undefined ? undefined : String(rest.id));
  const el = useRef<HTMLElement | null>(null);
  // React Aria disables a tab only by passing over it; this marks it held, read back by `isHeldKey`.
  const held = { ...(disabled ? { 'aria-disabled': true } : {}), ref: useHeldAriaRef(disabled, disabledReason, el) };
  const body = ({ isFocusVisible, isHovered }: TabRenderProps): ReactNode => (
    <>
      {children}
      {disabled && disabledReason && (isFocusVisible || isHovered) && (
        <TooltipTrigger open>
          <Tooltip triggerRef={el}>{disabledReason}</Tooltip>
        </TooltipTrigger>
      )}
    </>
  );
  if (slot === undefined) {
    return (
      <RACTab {...rest} {...held} className={[s.tab, className].filter(Boolean).join(' ')}>
        {body}
      </RACTab>
    );
  }
  const { className: _, style, ...at } = slot;
  return (
    <RACTab {...rest} {...held} {...at} className={slotClass(slot, [s.tab, className].filter(Boolean).join(' '))} style={{ ...(typeof rest.style === 'object' ? rest.style : null), ...style }}>
      {body}
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
