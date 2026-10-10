import { type ReactNode, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '../Tabs';

/** One group in a {@link GroupTabs} strip. */
export interface GroupTab {
  id: string;
  name: string;
  /** The group's rows, drawn while its tab is the one open. */
  content: ReactNode;
  /** Extra attributes for the tab, and for the panel while this tab is open. */
  attrs?: Record<string, string | undefined>;
  panelAttrs?: Record<string, string | undefined>;
}

/** Props for `<GroupTabs>`. */
export interface GroupTabsProps {
  tabs: readonly GroupTab[];
  /** `id` of the open tab, when the owner holds it. Unset, the strip keeps its own and starts on the first. */
  picked?: string;
  onPick?(id: string): void;
  className?: string;
}

/**
 * Sibling groups drawn `as: 'tab'`: one strip of their names over the rows of the one picked. What every surface
 * that draws a schema's groups uses, so a run of tabs reads the same in a form, a properties panel and a lab.
 */
export function GroupTabs({ tabs, picked, onPick, className }: GroupTabsProps) {
  const [own, setOwn] = useState(tabs[0]!.id);
  // A tab gone since it was picked falls back to the first still here.
  const open = tabs.find((t) => t.id === (picked ?? own)) ?? tabs[0]!;
  return (
    <Tabs
      className={className}
      selectedKey={open.id}
      onSelectionChange={(key) => {
        if (picked === undefined) setOwn(String(key));
        onPick?.(String(key));
      }}
    >
      <TabList aria-label="Groups">
        {tabs.map((t) => <Tab key={t.id} id={t.id} {...t.attrs}>{t.name}</Tab>)}
      </TabList>
      <TabPanel id={open.id} {...open.panelAttrs}>{open.content}</TabPanel>
    </Tabs>
  );
}
