import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyAutoReadout, PropertyRow } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof PropertyAutoReadout> = {
  title: 'ui/Properties/PropertyAutoReadout',
  component: PropertyAutoReadout,
};
export default meta;

type Story = StoryObj<typeof PropertyAutoReadout>;

/** An auto row that reads out the value it came to: the word in the label's case, the value as written. */
export const Default: Story = {
  args: { value: '12' },
  render: (args) => (
    <PropertyRow label="Count" layout="inline" auto readout={<PropertyAutoReadout {...args} />} onAutoChange={() => {}}>
      <input type="text" defaultValue="8" />
    </PropertyRow>
  ),
};
