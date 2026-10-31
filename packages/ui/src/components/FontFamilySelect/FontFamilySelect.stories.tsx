import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { FontFamilySelect } from '@weasel-js/ui/components/FontFamilySelect';

const meta: Meta<typeof FontFamilySelect> = {
  title: 'ui/Foundations/FontFamilySelect',
  component: FontFamilySelect,
};
export default meta;

type Story = StoryObj<typeof FontFamilySelect>;

/** Offers every family the font registry can paint. */
export const Default: Story = {
  render: (args) => {
    const [family, setFamily] = useState<string | undefined>(undefined);
    return <FontFamilySelect {...args} value={family} onChange={setFamily} />;
  },
};

/** A family nobody registered stays on offer as its own entry, naming what paints in its place. */
export const NotLoaded: Story = {
  render: (args) => {
    const [family, setFamily] = useState<string | undefined>('Comic Neue');
    return <FontFamilySelect {...args} value={family} onChange={setFamily} />;
  },
};

export const Mixed: Story = {
  args: { mixed: true, onChange: () => {} },
};
