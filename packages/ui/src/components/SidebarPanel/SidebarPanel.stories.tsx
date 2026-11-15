import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SidebarPanel, type SidebarPanelProps } from '@weasel-js/ui/components/SidebarPanel';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { Button } from '@weasel-js/ui/components/Button';
import s from './SidebarPanel.stories.module.css';

const meta: Meta<typeof SidebarPanel> = {
  title: 'ui/SidebarPanel',
  component: SidebarPanel,
  args: {
    title: 'Properties',
    children: (
      <div className={s.body}>
        Panel body — host any content here. Property grids, lists, custom widgets.
      </div>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof SidebarPanel>;

export const StaticHeader: Story = {};
export const Collapsible: Story = { args: { onCollapsedChange: () => {} } };
export const Closeable: Story = {
  args: { onCollapsedChange: () => {}, onHide: () => {} },
};
export const WithActions: Story = {
  args: {
    onCollapsedChange: () => {},
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
      <div className={s.hidden}>
        Panel hidden.{' '}
        <Button size="sm" onClick={() => setHidden(false)}>Show again</Button>
      </div>
    );
  }
  return (
    <Sidebar side="right" aria-label="Demo sidebar">
      <SidebarPanel
        {...args}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onHide={() => setHidden(true)}
      />
    </Sidebar>
  );
}

export const Interactive: Story = {
  args: {
    title: 'Selection',
    children: (
      <div className={s.body}>
        Click the title to collapse. Click ×  to hide entirely.
      </div>
    ),
  },
  render: (args) => <InteractiveSidebarPanel {...args} />,
};
