import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { FontWeightSelect } from '@weasel-js/ui/components/FontWeightSelect';

const meta: Meta<typeof FontWeightSelect> = {
  title: 'ui/Foundations/FontWeightSelect',
  component: FontWeightSelect,
};
export default meta;

type Story = StoryObj<typeof FontWeightSelect>;

/** No family has registered faces here, so it offers the nine CSS weights. */
export const CssWeights: Story = {
  render: (args) => {
    const [weight, setWeight] = useState(400);
    return <FontWeightSelect {...args} value={weight} onChange={setWeight} />;
  },
};

export const Mixed: Story = {
  args: { mixed: true, onChange: () => {} },
};
