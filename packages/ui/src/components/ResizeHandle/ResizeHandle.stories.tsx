import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResizeHandle } from './ResizeHandle';
import { Sidebar } from '../Sidebar';
import { SidebarPanel } from '../SidebarPanel';

const meta: Meta<typeof ResizeHandle> = {
  title: 'weasel-ui/ResizeHandle',
  component: ResizeHandle,
};
export default meta;

type Story = StoryObj<typeof ResizeHandle>;

/**
 * The common case: a sidebar docked to the trailing edge, so the handle is
 * inverted — dragging left makes the panel wider.
 */
function RightSidebarDemo() {
  const [width, setWidth] = useState(260);
  return (
    <div style={{ display: 'flex', height: 240, border: '1px solid var(--wzl-border)' }}>
      <div style={{ flex: 1, minWidth: 0, padding: 12, fontSize: 12 }}>
        Content area. Drag the divider, or focus it and use the arrow keys
        (Shift for a coarse step, Home/End for the bounds). Width: {width}px
      </div>
      <ResizeHandle
        value={width}
        min={200}
        max={600}
        invert
        onInput={setWidth}
        ariaLabel="Resize sidebar"
      />
      <Sidebar side="right" ariaLabel="Demo sidebar" style={{ width }}>
        <SidebarPanel title="Properties">
          <div style={{ padding: '4px 6px', fontSize: 12 }}>{width}px</div>
        </SidebarPanel>
      </Sidebar>
    </div>
  );
}

export const RightSidebar: Story = { render: () => <RightSidebarDemo /> };

/** Stacked panes: a horizontal handle dragged up and down. */
function BottomDrawerDemo() {
  const [height, setHeight] = useState(80);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 240,
      border: '1px solid var(--wzl-border)',
    }}>
      <div style={{ flex: 1, minHeight: 0, padding: 12, fontSize: 12 }}>
        Content area. Height below: {height}px
      </div>
      <ResizeHandle
        orientation="horizontal"
        value={height}
        min={40}
        max={200}
        invert
        onInput={setHeight}
        ariaLabel="Resize drawer"
      />
      <div style={{
        height, background: 'var(--wzl-surface)', padding: 12, fontSize: 12,
      }}>
        Drawer
      </div>
    </div>
  );
}

export const BottomDrawer: Story = { render: () => <BottomDrawerDemo /> };
