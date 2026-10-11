import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefLeaf } from '@weasel-js/prefs';
import { PrefLabelLine, PrefRule } from './PrefWords';

const note: PrefLeaf = { kind: 'label', name: 'Sizes are in world units.', description: 'Zoom does not change them.', default: undefined };

const meta: Meta<typeof PrefLabelLine> = {
  title: 'Primitives/PrefWords',
  component: PrefLabelLine,
  args: { pref: note },
};
export default meta;

type Story = StoryObj<typeof PrefLabelLine>;

/** A `label` leaf: its name, and its description as the note under it. */
export const Label: Story = {};

/** A `label` leaf with no description is the one line. */
export const LabelAlone: Story = { args: { pref: { ...note, description: '' } } };

/** A `separator` leaf between two labels. */
export const Separator: Story = {
  render: () => (
    <>
      <PrefLabelLine pref={{ ...note, description: '' }} />
      <PrefRule />
      <PrefLabelLine pref={{ ...note, name: 'Angles are in degrees.', description: '' }} />
    </>
  ),
};
