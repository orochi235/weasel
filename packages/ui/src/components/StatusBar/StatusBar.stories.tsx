import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBar, StatusBarItem, StatusBarSpacer } from './StatusBar';

const meta: Meta<typeof StatusBar> = {
  title: 'weasel-ui/StatusBar',
  component: StatusBar,
  args: { ariaLabel: 'Editor status' },
};
export default meta;

type Story = StoryObj<typeof StatusBar>;

export const Readouts: Story = {
  args: {
    children: (
      <>
        <StatusBarItem>tool: select</StatusBarItem>
        <StatusBarItem>sel: 3</StatusBarItem>
        <StatusBarItem>fill: #7ab8d4ff</StatusBarItem>
      </>
    ),
  },
};

/** The spacer splits the row: live readouts lead, reference material trails. */
export const WithTrailingGroup: Story = {
  args: {
    children: (
      <>
        <StatusBarItem>tool: pencil</StatusBarItem>
        <StatusBarItem>sel: 0</StatusBarItem>
        <StatusBarSpacer />
        <StatusBarItem>zoom: 55%</StatusBarItem>
        <StatusBarItem muted title="@weasel-js/core 0.7.0 — built 2026-07-30T18:22:04.000Z">
          0.7.0 · Jul 30
        </StatusBarItem>
      </>
    ),
  },
};
