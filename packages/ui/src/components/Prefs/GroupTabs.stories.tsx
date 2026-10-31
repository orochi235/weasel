import type { Meta, StoryObj } from '@weasel-js/forge';
import { GroupTabs, type GroupTab } from '@weasel-js/ui/components/Prefs';

const TABS: readonly GroupTab[] = [
  { id: 'fill', name: 'Fill', content: <p>The fill group's rows.</p> },
  { id: 'stroke', name: 'Stroke', content: <p>The stroke group's rows.</p> },
  { id: 'shadow', name: 'Shadow', content: <p>The shadow group's rows.</p> },
];

const meta: Meta<typeof GroupTabs> = {
  title: 'ui/Foundations/Prefs/GroupTabs',
  component: GroupTabs,
  args: { tabs: TABS },
};
export default meta;

type Story = StoryObj<typeof GroupTabs>;

/** Sibling groups drawn `as: 'tab'`: a strip of their names over the rows of the one picked. */
export const Default: Story = {};

/** A group its `enableIf` turns off dims its name, as a heading's does. Its tab still opens. */
export const OffGroup: Story = {
  args: { tabs: TABS.map((t) => (t.id === 'shadow' ? { ...t, disabled: true } : t)) },
};
