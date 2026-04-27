import type { Meta, StoryObj } from '@storybook/react';
import { LabShell } from './LabShell';

const meta: Meta<typeof LabShell> = {
  title: 'Lab/LabShell',
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
