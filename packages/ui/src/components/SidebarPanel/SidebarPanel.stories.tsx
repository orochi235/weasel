import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SidebarPanel, type SidebarPanelProps } from './SidebarPanel';
import { Sidebar } from '../Sidebar';
import { MenuButton } from '../MenuButton';

const meta: Meta<typeof SidebarPanel> = {
  title: 'ui/SidebarPanel',
  component: SidebarPanel,
  args: {
    title: 'Properties',
    children: (
      <div style={{ padding: '4px 6px', fontSize: 12 }}>
        Panel body — host any content here. Property grids, lists, custom widgets.
      </div>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof SidebarPanel>;

export const StaticHeader: Story = {};
export const Collapsible: Story = { args: { onToggleCollapse: () => {} } };
export const Closeable: Story = {
  args: { onToggleCollapse: () => {}, onHide: () => {} },
};
export const WithActions: Story = {
  args: {
    onToggleCollapse: () => {},
    onHide: () => {},
    actions: (
      <MenuButton bare current label="Panel" items={[{ value: 'bar', label: 'Show as toolbar' }, { value: 'menu', label: 'Show as menu' }]} />
    ),
  },
};

// Drive collapse + hide state locally so a reader can click both
// affordances and see them in action.
function InteractiveSidebarPanel(args: SidebarPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) {
    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        Panel hidden.{' '}
        <button type="button" onClick={() => setHidden(false)}>Show again</button>
      </div>
    );
  }
  return (
    <Sidebar side="right" ariaLabel="Demo sidebar">
      <SidebarPanel
        {...args}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onHide={() => setHidden(true)}
      />
    </Sidebar>
  );
}

export const Interactive: Story = {
  args: {
    title: 'Selection',
    children: (
      <div style={{ padding: '4px 6px', fontSize: 12 }}>
        Click the title to collapse. Click ×  to hide entirely.
      </div>
    ),
  },
  render: (args) => <InteractiveSidebarPanel {...args} />,
};
