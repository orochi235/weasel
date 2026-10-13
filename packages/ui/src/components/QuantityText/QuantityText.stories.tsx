import type { Meta, StoryObj } from '@weasel-js/forge';
import { decimal, fraction, percent, tag, unit } from '@weasel-js/quantity';
import { QuantityText } from './QuantityText';

const meta: Meta<typeof QuantityText> = {
  title: 'ui/QuantityText',
  component: QuantityText,
};
export default meta;
type Story = StoryObj<typeof QuantityText>;

/** One value under its own display: the unit sits back from the number. */
export const Value: Story = { render: () => <QuantityText value={tag(2.5, unit('ft'))} /> };

/** Two ends around a dash. They share a unit, so it is written once. */
export const Range: Story = { render: () => <QuantityText range={[tag(2, unit('ft')), tag(5, unit('ft'))]} /> };

/** Ends whose spoken form is not their text: a screen reader hears "1 over 64 to 1 over 2". */
export const SpokenRange: Story = { render: () => <QuantityText range={[tag(1 / 64, fraction()), tag(1 / 2, fraction())]} /> };

/** Members under a fallback display, each after its label. */
export const Vector: Story = { render: () => <QuantityText vector={[120, 48.5]} labels={['x', 'y']} display={decimal()} /> };

/** Members that each carry a display of their own. */
export const MixedVector: Story = {
  render: () => <QuantityText vector={[tag(2, unit('ft')), tag(0.5, percent())]} labels={['w', 'h']} separator=" × " />,
};
