import type { Meta, StoryObj } from '@storybook/react';
import { Toolbar } from './Toolbar';

const meta: Meta<typeof Toolbar> = {
  title: 'Primitives/Toolbar',
  component: Toolbar,
};
export default meta;

type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => (
    <Toolbar>
      <Toolbar.Title>My Workspace</Toolbar.Title>
      <Toolbar.Button onClick={() => {}}>Undo</Toolbar.Button>
      <Toolbar.Button onClick={() => {}}>Redo</Toolbar.Button>
      <Toolbar.Spacer />
      <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
    </Toolbar>
  ),
};

export const WithDisabled: Story = {
  render: () => (
    <Toolbar>
      <Toolbar.Title>Empty workspace</Toolbar.Title>
      <Toolbar.Button onClick={() => {}} disabled>
        Undo
      </Toolbar.Button>
      <Toolbar.Button onClick={() => {}} disabled>
        Redo
      </Toolbar.Button>
    </Toolbar>
  ),
};
