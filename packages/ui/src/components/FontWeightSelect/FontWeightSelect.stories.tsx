import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { FontWeightSelect } from './FontWeightSelect';

const meta: Meta<typeof FontWeightSelect> = {
  title: 'Primitives/FontWeightSelect',
  component: FontWeightSelect,
};
export default meta;

type Story = StoryObj<typeof FontWeightSelect>;

/** No family has registered faces here, so it offers the nine CSS weights. */
export const CssWeights: Story = {
  render: () => {
    const [weight, setWeight] = useState(400);
    return <FontWeightSelect value={weight} onChange={setWeight} />;
  },
};

export const Mixed: Story = {
  render: () => <FontWeightSelect mixed onChange={() => {}} />,
};
