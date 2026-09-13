import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import type { SidebarSlotContext } from '../types';
import { SidebarRegion } from './SidebarRegion';

const meta: Meta<typeof SidebarRegion> = {
  title: 'labkit/Chrome/SidebarRegion',
  component: SidebarRegion,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof SidebarRegion>;

const ctx: SidebarSlotContext = { collapsedSections: {}, setSectionCollapsed: () => {} };

// jsdom has no layout, so this runs in the browser story projects.
export const LastSectionFillsItsPane: Story = {
  render: () => (
    <div className="lk-root">
      <div className="lk-lab__aside" data-testid="pane" style={{ height: 400 }}>
        <SidebarRegion
          ctx={ctx}
          contributions={[
            { id: 'first', region: 'sidebar', item: { title: 'First', body: <p>one</p> } },
            { id: 'last', region: 'sidebar', item: { title: 'Last', body: <p>two</p> } },
          ]}
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const pane = canvasElement.querySelector('[data-testid="pane"]') as HTMLElement;
    const sections = [...pane.querySelectorAll<HTMLElement>('.lk-sidebar-section')];
    const first = sections[0] as HTMLElement;
    const last = sections[sections.length - 1] as HTMLElement;
    await expect(Math.round(last.getBoundingClientRect().bottom)).toBe(
      Math.round(pane.getBoundingClientRect().bottom),
    );
    await expect(getComputedStyle(last).borderBottomWidth).toBe('0px');
    await expect(getComputedStyle(first).borderBottomWidth).not.toBe('0px');
  },
};
