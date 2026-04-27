import type { Meta, StoryObj } from '@storybook/react';
import { StatusBar } from './StatusBar';

const meta: Meta<typeof StatusBar> = {
  title: 'Primitives/StatusBar',
  component: StatusBar,
};
export default meta;

type Story = StoryObj<typeof StatusBar>;

export const Plain: Story = {
  render: () => <StatusBar>Ready</StatusBar>,
};

export const Sections: Story = {
  render: () => (
    <StatusBar>
      <StatusBar.Section>Items: 12</StatusBar.Section>
      <StatusBar.Section>Zoom: 100%</StatusBar.Section>
      <StatusBar.Section>FPS: 60</StatusBar.Section>
    </StatusBar>
  ),
};
