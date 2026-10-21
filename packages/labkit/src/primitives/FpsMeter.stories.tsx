import type { Meta, StoryObj } from '@weasel-js/forge';
import { FpsMeter } from '@weasel-js/labkit/primitives';

const meta: Meta<typeof FpsMeter> = {
  title: 'labkit/Primitives/FpsMeter',
  component: FpsMeter,
};
export default meta;

type Story = StoryObj<typeof FpsMeter>;

export const Default: Story = {};
