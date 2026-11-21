import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefKind } from '@weasel-js/prefs';
import { PrefKindBadge } from '@weasel-js/ui/components/Prefs';
import { Sequence, valuesSweep } from '@weasel-js/ui/components/Sequence';

const meta: Meta<typeof PrefKindBadge> = {
  title: 'ui/Prefs/PrefKindBadge',
  component: PrefKindBadge,
  args: { kind: 'number' },
};
export default meta;

type Story = StoryObj<typeof PrefKindBadge>;

export const Default: Story = {};

// A record so a kind added to `PrefKind` cannot be left out.
const BUILT_IN: Record<PrefKind, true> = {
  number: true, boolean: true, string: true, enum: true, color: true, paint: true, object: true, list: true, map: true,
  union: true, field: true, action: true, actions: true, alias: true, label: true, separator: true,
};
const KINDS = [...Object.keys(BUILT_IN), 'registry-enum', 'group'];

/** Every built-in kind, then a custom kind and a group. A kind with no color of its own is drawn muted. */
export const AllKinds: Story = {
  render: (args) => (
    <Sequence aria-label="Pref kinds" sweep={valuesSweep(KINDS)} caption={false}>
      {(k) => <PrefKindBadge {...args} kind={k} />}
    </Sequence>
  ),
};
