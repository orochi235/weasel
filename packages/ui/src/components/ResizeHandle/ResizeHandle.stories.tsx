import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import s from './ResizeHandle.stories.module.css';

const meta: Meta<typeof ResizeHandle> = {
  title: 'ui/ResizeHandle',
  component: ResizeHandle,
};
export default meta;

type Story = StoryObj<typeof ResizeHandle>;

/**
 * The common case: a sidebar docked to the trailing edge, so the handle is
 * inverted — dragging left makes the panel wider.
 */
export const RightSidebar: Story = {
  args: { value: 260, min: 200, max: 600, invert: true, 'aria-label': 'Resize sidebar' },
  render: (args) => {
    const [width, setWidth] = useState(args.value);
    return (
      <div className={s.row}>
        <div className={s.content}>
          Content area. Drag the divider, or focus it and use the arrow keys
          (Shift for a coarse step, Home/End for the bounds). Width: {width}px
        </div>
        <ResizeHandle {...args} value={width} onInput={setWidth} />
        <Sidebar side="right" aria-label="Demo sidebar" style={{ width }}>
          <SidebarPanel title="Properties">
            <div className={s.body}>{width}px</div>
          </SidebarPanel>
        </Sidebar>
      </div>
    );
  },
};

/** Stacked panes: a horizontal handle dragged up and down. */
export const BottomDrawer: Story = {
  args: {
    orientation: 'horizontal', value: 80, min: 40, max: 200, invert: true,
    'aria-label': 'Resize drawer',
  },
  render: (args) => {
    const [height, setHeight] = useState(args.value);
    return (
      <div className={s.column}>
        <div className={s.content}>
          Content area. Height below: {height}px
        </div>
        <ResizeHandle {...args} value={height} onInput={setHeight} />
        <div className={s.drawer} style={{ height }}>
          Drawer
        </div>
      </div>
    );
  },
};
