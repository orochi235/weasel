import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect, within } from '@weasel-js/forge/play';
import { Lab, useLabContext } from '@weasel-js/labkit';
import { useEffect } from 'react';
import type { Instrument } from '../instrument/types';
import './Lab.stories.less';

const StubInstrument: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({ value: 50 }),
  initialState: (config) => ({ doubled: (config as { value: number }).value * 2 }),
  render: ({ state }) => (
    <div className="lk-stub-display">doubled: {(state as { doubled: number }).doubled}</div>
  ),
};

const meta: Meta<typeof Lab> = {
  title: 'labkit/Lab/Lab',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lab>;

export const Default: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Default Lab',
  },
};

function AddSecondTrial() {
  const ctx = useLabContext();
  useEffect(() => {
    if (ctx.trials.length < 2) ctx.addTrial('Stub');
  }, [ctx]);
  return null;
}

export const TwoTrials: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Two Trials',
    children: <AddSecondTrial />,
  },
};

/** The title, the menus and the controls share one bar, as an app's title bar does. */
export const MenusInHeader: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Menus in the header',
  },
};

/** At phone width the bar stays one row: the title truncates, and add trial, zoom and the theme
 *  switch give way to the Lab and View menus that also hold them. jsdom has no container queries,
 *  so this runs in the browser story projects. */
export const MenusInHeaderNarrow: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Menus in a narrow header',
  },
  render: (args) => (
    <div className="lk-story-phone">
      <Lab {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvasElement.querySelector('.lk-shell-header');
    const title = canvasElement.querySelector('.lk-shell-title');
    if (!header || !title) throw new Error('no header or title');
    const row = title.getBoundingClientRect();
    const edge = header.getBoundingClientRect().right;
    for (const child of header.children) {
      const box = child.getBoundingClientRect();
      await expect(box.top < row.bottom && box.bottom > row.top).toBe(true);
      await expect(box.right).toBeLessThanOrEqual(edge + 1);
    }
    const bar = canvas.getByRole('menubar', { name: 'Lab menu bar' }).getBoundingClientRect();
    await expect(bar.width).toBeGreaterThan(0);
    await expect(canvas.queryByRole('button', { name: 'Add trial' })).toBeNull();
  },
};
