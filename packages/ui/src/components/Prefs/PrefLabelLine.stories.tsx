import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm, PrefLabelLine, PrefRule } from '@weasel-js/ui/components/Prefs';

const note: PrefLeaf = { kind: 'label', name: 'Sizes are in world units.', description: 'Zoom does not change them.', default: undefined };

const meta: Meta<typeof PrefLabelLine> = {
  title: 'ui/Foundations/Prefs/PrefLabelLine',
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
  render: (args) => (
    <>
      <PrefLabelLine {...args} pref={{ ...note, description: '' }} />
      <PrefRule />
      <PrefLabelLine {...args} pref={{ ...note, name: 'Angles are in degrees.', description: '' }} />
    </>
  ),
};

const FORM: PrefGroup = {
  name: 'Units',
  children: {
    intro: { kind: 'label', name: 'Sizes are in world units.', description: 'Zoom does not change them.', default: undefined },
    width: { kind: 'number', name: 'Width', description: 'Of a new shape.', default: 120, min: 1, max: 999 },
    rule: { kind: 'separator', name: '', description: '', default: undefined },
    angles: { kind: 'label', name: 'Angles are in degrees.', description: '', default: undefined },
    turn: { kind: 'number', name: 'Turn', description: 'Of a new shape.', default: 0, min: -180, max: 180 },
  },
};

/** Both kinds as rows of a `PrefsForm`, between rows that hold a control. */
export const InForm: Story = {
  render: () => <PrefsForm layout="list" schema={FORM} values={{}} onChange={() => {}} />,
};
