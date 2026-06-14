import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sidebar } from './Sidebar';
import { SidebarPanel } from '../SidebarPanel';

const meta: Meta<typeof Sidebar> = {
  title: 'weasel-ui/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

const PanelStack = () => (
  <>
    <SidebarPanel title="Selection">
      <div style={{ padding: '4px 6px', fontSize: 12 }}>2 items selected</div>
    </SidebarPanel>
    <SidebarPanel title="Colors">
      <div style={{ padding: '4px 6px', fontSize: 12 }}>Fill / Stroke swatches</div>
    </SidebarPanel>
    <SidebarPanel title="Layers">
      <div style={{ padding: '4px 6px', fontSize: 12 }}>Layer list goes here</div>
    </SidebarPanel>
  </>
);

export const LeftDock: Story = {
  args: { side: 'left', ariaLabel: 'Left sidebar', children: <PanelStack /> },
  render: (args) => (
    <div style={{ display: 'flex', height: 320 }}>
      <Sidebar {...args} />
      <div style={{ flex: 1, padding: 16, fontSize: 12 }}>Stage area</div>
    </div>
  ),
};

export const RightDock: Story = {
  args: { side: 'right', ariaLabel: 'Right sidebar', children: <PanelStack /> },
  render: (args) => (
    <div style={{ display: 'flex', height: 320 }}>
      <div style={{ flex: 1, padding: 16, fontSize: 12 }}>Stage area</div>
      <Sidebar {...args} />
    </div>
  ),
};
