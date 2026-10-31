import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyReadout } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof PropertyReadout> = {
  title: 'ui/Properties/PropertyReadout',
  component: PropertyReadout,
};
export default meta;

type Story = StoryObj<typeof PropertyReadout>;

/** A number in its display, with its unit. */
export const Default: Story = {
  args: { kind: 'number', name: 'Width', value: 120, unit: 'px', onChange: () => {} },
};

/** A color as a swatch beside its hex. */
export const Color: Story = {
  args: { kind: 'color', name: 'Fill', value: '#3a7bd5', onChange: () => {} },
};

/** Fields whose values differ read `Mixed`. */
export const Mixed: Story = {
  args: { kind: 'number', name: 'Width', value: undefined, mixed: true, onChange: () => {} },
};
