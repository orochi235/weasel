import type { Meta, StoryObj } from '@storybook/react';
import { FpsMeter } from './FpsMeter';

const meta: Meta<typeof FpsMeter> = {
  title: 'Primitives/FpsMeter',
  component: FpsMeter,
};
export default meta;

type Story = StoryObj<typeof FpsMeter>;

export const Default: Story = {
  render: () => <FpsMeter />,
};
