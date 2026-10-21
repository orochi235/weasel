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
export const Value: Story = { args: { value: tag(2.5, unit('ft')) } };

/** Two ends around a dash. They share a unit, so it is written once. */
export const Range: Story = { args: { range: [tag(2, unit('ft')), tag(5, unit('ft'))] } };

/** Ends whose spoken form is not their text: a screen reader hears "1 over 64 to 1 over 2". */
export const SpokenRange: Story = { args: { range: [tag(1 / 64, fraction()), tag(1 / 2, fraction())] } };

/** A fraction drawn as MathML, numerator over denominator. A copy still reads `3/4`. */
export const Stacked: Story = { args: { value: tag(3 / 4, fraction({ form: 'stacked' })) } };

/** Members under a fallback display, each after its label. */
export const Vector: Story = { args: { vector: [120, 48.5], labels: ['x', 'y'], display: decimal() } };

/** Members that each carry a display of their own. */
export const MixedVector: Story = {
  args: { vector: [tag(2, unit('ft')), tag(0.5, percent())], labels: ['w', 'h'], separator: ' × ' },
};

/** Inside a control that speaks the value itself: the marked-up text and no second copy for a reader. */
export const Muted: Story = { args: { value: tag(2.5, unit('ft')), mute: true } };
