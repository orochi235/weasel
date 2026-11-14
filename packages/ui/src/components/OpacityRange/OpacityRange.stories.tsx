import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { OpacityRange } from '@weasel-js/ui/components/OpacityRange';

const meta: Meta<typeof OpacityRange> = {
  title: 'ui/OpacityRange',
  component: OpacityRange,
  args: { disabled: false, readOnly: false },
};
export default meta;

type Story = StoryObj<typeof OpacityRange>;

/** A slider and its percent readout, as two inline items for the caller's own row; one change per gesture. */
export const Default: Story = {
  render: (args) => {
    const [alpha, setAlpha] = useState(0.7);
    return <OpacityRange aria-label="Fill" {...args} value={alpha} onInput={setAlpha} onChange={setAlpha} />;
  },
};
