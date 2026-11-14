import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ToolRail, type ToolRailItem, type ToolRailProps } from '@weasel-js/ui/components/ToolRail';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ToolRail> = {
  title: 'ui/ToolRail',
  component: ToolRail,
};
export default meta;

type Story = StoryObj<typeof ToolRail>;

const TOOLS = [
  { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: { key: 'v' }, group: 'pick' },
  { id: 'lasso', label: 'Lasso', icon: icon('core:lasso'), shortcut: { key: 'l' }, group: 'pick' },
  { id: 'pen', label: 'Pen', icon: icon('core:pen'), shortcut: { key: 'p' }, group: 'draw' },
  { id: 'text', label: 'Text', icon: icon('core:text'), shortcut: { key: 't' }, group: 'draw' },
  { id: 'hand', label: 'Hand', icon: icon('core:hand'), shortcut: { key: 'h' }, group: 'view' },
] as const;

/** A rail holding its own selection, the way any consumer of items does. */
function Demo(props: Partial<ToolRailProps> & { withStack?: boolean; withCommand?: boolean }) {
  const { withStack, withCommand, ...rest } = props;
  const [active, setActive] = useState('select');
  const [grid, setGrid] = useState(false);
  const buttons = TOOLS.map((t) => ({ ...t, active: active === t.id, onPress: () => setActive(t.id) }));
  const shapes = [
    { id: 'rect', label: 'Rect', icon: icon('core:rect') },
    { id: 'ellipse', label: 'Ellipse', icon: icon('core:ellipse') },
    { id: 'star', label: 'Star', icon: icon('core:star') },
  ].map((t) => ({ ...t, active: active === t.id, onPress: () => setActive(t.id) }));
  const items: ToolRailItem[] = [
    ...buttons,
    ...(withStack ? [{ id: 'shapes', group: 'draw', members: shapes }] : []),
    ...(withCommand ? [{ id: 'grid', label: 'Grid', icon: icon('ui:grid'), active: grid, onPress: () => setGrid((g) => !g) }] : []),
  ];
  return <ToolRail {...rest} items={items} />;
}

export const Default: Story = { render: (args) => <Demo {...args} /> };
export const Horizontal: Story = { args: { orientation: 'horizontal' }, render: (args) => <Demo {...args} /> };
export const Columns: Story = { args: { columns: 2 }, render: (args) => <Demo {...args} /> };
export const WithStack: Story = { render: (args) => <Demo {...args} withStack /> };
/** A command latches while its own state says so; it never takes the rail's selection. */
export const WithCommand: Story = { render: (args) => <Demo {...args} withCommand /> };
export const Disabled: Story = {
  render: () => (
    <ToolRail items={[
      { id: 'select', label: 'Select', icon: icon('core:select'), active: true, onPress: () => {} },
      { id: 'pen', label: 'Pen', icon: icon('core:pen'), disabled: true, disabledReason: 'Locked layer', onPress: () => {} },
    ]} />
  ),
};
