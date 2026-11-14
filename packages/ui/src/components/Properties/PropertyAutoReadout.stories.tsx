import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyAutoReadout, PropertyRow, RowScope } from '@weasel-js/ui/components/Properties';

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
    <RowScope auto onAutoChange={() => {}}>
      <PropertyRow label="Count" layout="inline" readout={<PropertyAutoReadout {...args} />}>
        <input type="text" defaultValue="8" />
      </PropertyRow>
    </RowScope>
  ),
};
