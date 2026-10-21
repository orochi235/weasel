import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect, waitFor } from '@weasel-js/forge/play';
import { LabRoot } from '@weasel-js/labkit';
import { SidebarPanes } from '@weasel-js/labkit/chrome';
import { useState } from 'react';
import type { SidebarSlotContext } from '../types';

const meta: Meta<typeof SidebarPanes> = {
  title: 'labkit/Chrome/SidebarPanes',
  component: SidebarPanes,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof SidebarPanes>;

const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => `line ${i + 1}`).map((text) => <p key={text}>{text}</p>);

function Stack() {
  const [collapsedSections, setFolds] = useState<Record<string, boolean>>({});
  const [heights, setHeights] = useState<Record<string, number>>({ long: 160 });
  const ctx: SidebarSlotContext = {
    collapsedSections,
    setSectionCollapsed: (id, collapsed) => setFolds((f) => ({ ...f, [id]: collapsed })),
  };
  return (
    <LabRoot>
      <div className="lk-lab__aside" data-testid="pane" style={{ height: 400 }}>
        <SidebarPanes
          ctx={ctx}
          heights={heights}
          onHeightsChange={setHeights}
          contributions={[
            { id: 'long', region: 'sidebar', item: { title: 'Long', body: lines(40) } },
            { id: 'short', region: 'sidebar', item: { title: 'Short', body: lines(2) } },
            { id: 'last', region: 'sidebar', item: { title: 'Last', body: lines(40) } },
          ]}
        />
      </div>
    </LabRoot>
  );
}

// jsdom has no layout, so this runs in the browser story projects.
export const SectionsScrollApart: Story = {
  render: () => <Stack />,
  play: async ({ canvasElement }) => {
    const pane = canvasElement.querySelector('[data-testid="pane"]') as HTMLElement;
    const sections = [...pane.querySelectorAll<HTMLElement>('.lk-sidebar-section')];
    const [long, , last] = sections as [HTMLElement, HTMLElement, HTMLElement];
    await waitFor(() => expect(Math.round(long.getBoundingClientRect().height)).toBe(160));
    await expect(Math.round(last.getBoundingClientRect().bottom)).toBe(
      Math.round(pane.getBoundingClientRect().bottom),
    );
    await expect(pane.scrollHeight).toBe(pane.clientHeight);

    const body = long.querySelector('.lk-sidebar-section__body') as HTMLElement;
    const bar = long.querySelector('.lk-sidebar-section__bar') as HTMLElement;
    const barTop = bar.getBoundingClientRect().top;
    body.scrollTop = 200;
    await expect(body.scrollTop).toBe(200);
    await expect(bar.getBoundingClientRect().top).toBe(barTop);
    await expect((last.querySelector('.lk-sidebar-section__body') as HTMLElement).scrollTop).toBe(
      0,
    );
  },
};
