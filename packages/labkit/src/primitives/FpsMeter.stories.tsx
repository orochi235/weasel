import type { Meta, StoryObj } from '@storybook/react-vite';
import { FpsMeter } from './FpsMeter';

const meta: Meta<typeof FpsMeter> = {
  title: 'labkit/Primitives/FpsMeter',
  component: FpsMeter,
};
export default meta;

type Story = StoryObj<typeof FpsMeter>;

export const Default: Story = {
  render: () => <FpsMeter />,
};
