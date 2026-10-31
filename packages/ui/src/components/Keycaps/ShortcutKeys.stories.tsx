import type { Meta, StoryObj } from '@weasel-js/forge';
import { ShortcutKeys } from '@weasel-js/ui/components/Keycaps';

const meta: Meta<typeof ShortcutKeys> = {
  title: 'ui/Foundations/Keycaps/ShortcutKeys',
  component: ShortcutKeys,
};
export default meta;

type Story = StoryObj<typeof ShortcutKeys>;

/** A shortcut already written out, as `formatShortcut` writes one. */
export const Default: Story = { args: { legend: '⇧⌘Z' } };

/** A shortcut reached through a keymap: the keymaps that lead to it come first. */
export const Leader: Story = { args: { legend: 'Loupe ▸ 2' } };
