import type { Meta, StoryObj } from '@weasel-js/forge';
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

const KINDS = ['number', 'boolean', 'string', 'enum', 'color', 'paint', 'object', 'field', 'registry-enum', 'group'];

/** Every built-in kind, then a custom kind and a group, which are drawn muted. */
export const AllKinds: Story = {
  render: (args) => (
    <Sequence aria-label="Pref kinds" sweep={valuesSweep(KINDS)} caption={false}>
      {(k) => <PrefKindBadge {...args} kind={k} />}
    </Sequence>
  ),
};
