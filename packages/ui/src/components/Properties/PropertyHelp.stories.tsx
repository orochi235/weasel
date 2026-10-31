import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyHelp } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof PropertyHelp> = {
  title: 'ui/Properties/PropertyHelp',
  component: PropertyHelp,
  args: { label: 'Corner radius', description: 'Rounds every corner by the same amount. **0** keeps them square.' },
};
export default meta;

type Story = StoryObj<typeof PropertyHelp>;

/** Standing alone, beside a label drawn outside a `PropertyRow`: an ⓘ button that is a tab stop, its tooltip the description. */
export const Default: Story = {
  render: (args) => <PropertyHelp {...args}>Corner radius</PropertyHelp>,
};

/** With `autoValue`, the tooltip ends on what the setting reads while it is auto. */
export const Auto: Story = {
  args: { autoValue: '4px' },
  render: (args) => <PropertyHelp {...args}>Corner radius</PropertyHelp>,
};
