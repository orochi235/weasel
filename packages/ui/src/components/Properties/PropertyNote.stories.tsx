import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { PropertyField, PropertyList, PropertyNote } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof PropertyNote> = {
  title: 'ui/Properties/PropertyNote',
  component: PropertyNote,
  args: { children: 'Sizes are in world units, so zoom does not change them.' },
};
export default meta;

type Story = StoryObj<typeof PropertyNote>;

/** A group's help text, across both columns of the list, above the rows it describes. */
export const Default: Story = {
  render: (args) => {
    const [width, setWidth] = useState(120);
    const [height, setHeight] = useState(80);
    return (
      <PropertyList>
        <PropertyNote {...args} />
        <PropertyField kind="number" label="Width" value={width} onChange={setWidth} />
        <PropertyField kind="number" label="Height" value={height} onChange={setHeight} />
      </PropertyList>
    );
  },
};
