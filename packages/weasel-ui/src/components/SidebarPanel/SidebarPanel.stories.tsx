import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SidebarPanel } from './SidebarPanel';
import { Sidebar } from '../Sidebar';

const meta: Meta<typeof SidebarPanel> = {
  title: 'weasel-ui/SidebarPanel',
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

// Drive collapse + hide state locally so storybook users can click both
// affordances and see them in action.
function InteractiveSidebarPanel() {
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
        title="Selection"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onHide={() => setHidden(true)}
      >
        <div style={{ padding: '4px 6px', fontSize: 12 }}>
          Click the title to collapse. Click ×  to hide entirely.
        </div>
      </SidebarPanel>
    </Sidebar>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveSidebarPanel />,
};
