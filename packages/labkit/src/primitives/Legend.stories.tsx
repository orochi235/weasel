import type { Meta, StoryObj } from '@storybook/react-vite';
import { Legend } from './Legend';

const meta: Meta<typeof Legend> = {
  title: 'labkit/Primitives/Legend',
  component: Legend,
};
export default meta;

type Story = StoryObj<typeof Legend>;

export const AllMarks: Story = {
  args: {
    entries: [
      { key: 'contour', label: 'contour', color: '#7d7f86' },
      { key: 'floor', label: 'bend floor', color: '#9a9ca3', mark: 'dash' },
      { key: 'authored', label: 'authored', color: '#2aa87a', mark: 'dot' },
      { key: 'replaced', label: 'replaced', color: 'rgba(255,107,96,.28)', mark: 'band' },
    ],
  },
};

export const DefaultMark: Story = {
  args: {
    entries: [
      { key: 'a', label: 'input', color: '#4c9be8' },
      { key: 'b', label: 'output', color: '#e8a04c' },
    ],
  },
};

export const Empty: Story = { args: { entries: [] } };
