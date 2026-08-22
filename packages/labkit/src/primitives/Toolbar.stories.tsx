import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from './Toolbar';

const meta: Meta<typeof Toolbar> = {
  title: 'labkit/Primitives/Toolbar',
  component: Toolbar,
};
export default meta;

type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => (
    <Toolbar>
      <Toolbar.Title>My Trial</Toolbar.Title>
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
      <Toolbar.Title>Empty trial</Toolbar.Title>
      <Toolbar.Button onClick={() => {}} disabled>
        Undo
      </Toolbar.Button>
      <Toolbar.Button onClick={() => {}} disabled>
        Redo
      </Toolbar.Button>
    </Toolbar>
  ),
};
