import { useState, type ReactElement } from 'react';
import type { EasingSpec } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyList, PropertyRow } from '@weasel-js/ui/components/Properties';
import { EasingPicker, type EasingPickerProps } from '@weasel-js/ui/components/Timeline';

const meta: Meta<typeof EasingPicker> = {
  title: 'ui/EasingPicker',
  component: EasingPicker,
};
export default meta;

type Story = StoryObj<typeof EasingPicker>;

function Held(props: Partial<EasingPickerProps>): ReactElement {
  const [value, setValue] = useState<EasingSpec | undefined>('easeOutCubic');
  return <EasingPicker {...props} value={value} onChange={setValue} />;
}

/** Standing alone, it names its menu `Easing`. */
export const Default: Story = {
  render: (args) => <Held {...args} />,
};

/** In a property row the row's label names the menu, so the picker draws none of its own. */
export const InARow: Story = {
  render: (args) => (
    <PropertyList pack="one-up">
      <PropertyRow group label="Fade ease">
        <Held {...args} />
      </PropertyRow>
    </PropertyList>
  ),
};
