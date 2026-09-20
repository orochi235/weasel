import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect, within } from '@weasel-js/forge/play';
import { Select, ToggleBar } from '../passthrough/weasel-ui';
import { Toolbar } from '../primitives/Toolbar';
import { LabShell } from './LabShell';

const meta: Meta<typeof LabShell> = {
  title: 'labkit/Lab/LabShell',
  component: LabShell,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof LabShell>;

export const Default: Story = {
  args: {
    title: 'My Lab',
    children: <p>Body content goes here.</p>,
  },
};

export const WithHeaderActions: Story = {
  args: {
    title: 'My Lab',
    header: (
      <>
        <button type="button">+ Add</button>
        <button type="button">Reset</button>
      </>
    ),
    children: <p>Body content with header actions.</p>,
  },
};

export const WithFooter: Story = {
  args: {
    title: 'My Lab',
    children: <p>Body content with footer.</p>,
    footer: <span>Status: ready</span>,
  },
};

// jsdom has no layout, so this runs in the browser story projects.
export const HeaderControlsLineUp: Story = {
  args: {
    title: 'My Lab',
    header: (
      <>
        <button type="button">Add</button>
        <ToggleBar
          ariaLabel="Mode"
          items={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
          value="a"
          onChange={() => {}}
        />
        <Select
          aria-label="Font"
          width="fit"
          selectedKey="oswald"
          options={[{ value: 'oswald', label: 'Oswald' }]}
        />
        <Toolbar aria-label="Actions">
          <Toolbar.Group>
            <Toolbar.Button onClick={() => {}}>Undo</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>
      </>
    ),
    children: <p>Body content.</p>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = [
      canvas.getByRole('button', { name: 'Add' }),
      canvas.getByRole('radiogroup', { name: 'Mode' }),
      canvas.getByRole('button', { name: /Font/ }),
      canvas.getByRole('button', { name: 'Undo' }),
    ].map((el) => el.getBoundingClientRect());
    const heights = boxes.map((box) => Math.round(box.height * 2) / 2);
    const middles = boxes.map((box) => Math.round((box.top + box.height / 2) * 2) / 2);
    await expect(heights).toEqual(heights.map(() => heights[0]));
    await expect(middles).toEqual(middles.map(() => middles[0]));
  },
};
