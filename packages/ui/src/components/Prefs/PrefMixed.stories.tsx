import type { Meta, StoryObj } from '@weasel-js/forge';
import { PrefMixed } from '@weasel-js/ui/components/Prefs';

const meta: Meta<typeof PrefMixed> = {
  title: 'ui/Foundations/Prefs/PrefMixed',
  component: PrefMixed,
};
export default meta;

type Story = StoryObj<typeof PrefMixed>;

/** In place of a `list` or `map` leaf's editor where the values it stands for differ. */
export const Default: Story = {};

/** With `onReplace` it offers to start them all over from nothing. */
export const Replaceable: Story = { args: { onReplace: () => {} } };
