import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect } from '@weasel-js/forge/play';
import { LabRoot } from '@weasel-js/labkit';
import { SidebarRegion } from '@weasel-js/labkit/chrome';
import type { SidebarSlotContext } from '../types';

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
  render: (args) => (
    <LabRoot>
      <div className="lk-lab__aside" data-testid="pane" style={{ height: 400 }}>
        <SidebarRegion {...args}
          ctx={ctx}
          contributions={[
            { id: 'first', region: 'sidebar', item: { title: 'First', body: <p>one</p> } },
            { id: 'last', region: 'sidebar', item: { title: 'Last', body: <p>two</p> } },
          ]}
        />
      </div>
    </LabRoot>
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
