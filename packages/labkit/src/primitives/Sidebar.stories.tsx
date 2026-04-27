import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Sidebar } from './Sidebar';

const meta: Meta<typeof Sidebar> = {
  title: 'Primitives/Sidebar',
  component: Sidebar,
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  render: () => (
    <div style={{ display: 'flex', height: 400 }}>
      <div style={{ flex: 1 }}>main content area</div>
      <Sidebar title="Controls">
        <p>One slider here</p>
        <p>Another slider</p>
      </Sidebar>
    </div>
  ),
};

export const Collapsible: Story = {
  render: function Render() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div style={{ display: 'flex', height: 400 }}>
        <div style={{ flex: 1, padding: 16 }}>main content area</div>
        <Sidebar title="Controls" collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)}>
          <p>One slider here</p>
          <p>Another slider</p>
        </Sidebar>
      </div>
    );
  },
};
