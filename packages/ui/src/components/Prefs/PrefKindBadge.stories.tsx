import type { Meta, StoryObj } from '@weasel-js/forge';
import { PrefKindBadge } from './PrefKindBadge';
import s from './PrefKindBadge.stories.module.css';

const meta: Meta<typeof PrefKindBadge> = {
  title: 'Primitives/PrefKindBadge',
  component: PrefKindBadge,
  args: { kind: 'number' },
};
export default meta;

type Story = StoryObj<typeof PrefKindBadge>;

export const Default: Story = {};

/** Every built-in kind, then a custom kind and a group, which are drawn muted. */
export const AllKinds: Story = {
  render: () => (
    <div className={s.row}>
      {['number', 'boolean', 'string', 'enum', 'color', 'paint', 'object', 'field', 'registry-enum', 'group'].map((k) => (
        <PrefKindBadge key={k} kind={k} />
      ))}
    </div>
  ),
};
