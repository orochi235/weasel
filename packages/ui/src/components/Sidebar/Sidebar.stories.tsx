import type { Meta, StoryObj } from '@weasel-js/forge';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import s from './Sidebar.stories.module.css';

const meta: Meta<typeof Sidebar> = {
  title: 'ui/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

const PanelStack = () => (
  <>
    <SidebarPanel title="Selection">
      <div className={s.body}>2 items selected</div>
    </SidebarPanel>
    <SidebarPanel title="Colors">
      <div className={s.body}>Fill / Stroke swatches</div>
    </SidebarPanel>
    <SidebarPanel title="Layers">
      <div className={s.body}>Layer list goes here</div>
    </SidebarPanel>
  </>
);

export const LeftDock: Story = {
  args: { side: 'left', 'aria-label': 'Left sidebar', children: <PanelStack /> },
  render: (args) => (
    <div className={s.frame}>
      <Sidebar {...args} />
      <div className={s.stage}>Stage area</div>
    </div>
  ),
};

export const RightDock: Story = {
  args: { side: 'right', 'aria-label': 'Right sidebar', children: <PanelStack /> },
  render: (args) => (
    <div className={s.frame}>
      <div className={s.stage}>Stage area</div>
      <Sidebar {...args} />
    </div>
  ),
};
