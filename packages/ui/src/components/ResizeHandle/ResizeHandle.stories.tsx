import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';

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
  args: { value: 260, min: 200, max: 600, invert: true, ariaLabel: 'Resize sidebar' },
  render: (args) => {
    const [width, setWidth] = useState(args.value);
    return (
      <div style={{ display: 'flex', height: 240, border: '1px solid var(--wzl-border)' }}>
        <div style={{ flex: 1, minWidth: 0, padding: 12, fontSize: 12 }}>
          Content area. Drag the divider, or focus it and use the arrow keys
          (Shift for a coarse step, Home/End for the bounds). Width: {width}px
        </div>
        <ResizeHandle {...args} value={width} onInput={setWidth} />
        <Sidebar side="right" ariaLabel="Demo sidebar" style={{ width }}>
          <SidebarPanel title="Properties">
            <div style={{ padding: '4px 6px', fontSize: 12 }}>{width}px</div>
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
    ariaLabel: 'Resize drawer',
  },
  render: (args) => {
    const [height, setHeight] = useState(args.value);
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: 240,
        border: '1px solid var(--wzl-border)',
      }}>
        <div style={{ flex: 1, minHeight: 0, padding: 12, fontSize: 12 }}>
          Content area. Height below: {height}px
        </div>
        <ResizeHandle {...args} value={height} onInput={setHeight} />
        <div style={{
          height, background: 'var(--wzl-surface)', padding: 12, fontSize: 12,
        }}>
          Drawer
        </div>
      </div>
    );
  },
};
