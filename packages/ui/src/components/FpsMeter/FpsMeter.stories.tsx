import type { Meta, StoryObj } from '@weasel-js/forge';
import { FpsMeter } from '@weasel-js/ui/components/FpsMeter';

const meta: Meta<typeof FpsMeter> = {
  title: 'ui/FpsMeter',
  component: FpsMeter,
};
export default meta;

type Story = StoryObj<typeof FpsMeter>;

export const Default: Story = {};
