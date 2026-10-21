import type { Meta, StoryObj } from '@weasel-js/forge';
import { ButtonBar, type ButtonBarItem } from '@weasel-js/ui/components/ButtonBar';

const meta: Meta<typeof ButtonBar> = {
  title: 'ui/Foundations/ButtonBar',
  component: ButtonBar,
};

export default meta;
type Story = StoryObj<typeof ButtonBar>;

const items: ButtonBarItem[] = [
  { value: 'undo', label: 'Undo', onAction: () => console.log('undo') },
  { value: 'redo', label: 'Redo', onAction: () => console.log('redo') },
  { value: 'clear', label: 'Clear', onAction: () => console.log('clear') },
];

export const Default: Story = { args: { items } };
export const Minimal: Story = { args: { items, variant: 'minimal' } };
export const Flat: Story = { args: { items, variant: 'flat' } };

/** `shortcut` shows in each button's tooltip as `Name (key)`. */
export const Tooltips: Story = {
  args: {
    items: [
      { value: 'undo', label: 'Undo', shortcut: '⌘Z', onAction: () => console.log('undo') },
      { value: 'redo', label: 'Redo', shortcut: '⇧⌘Z', onAction: () => console.log('redo') },
      { value: 'clear', label: 'Clear', tooltip: 'Remove every mark', onAction: () => console.log('clear') },
    ],
  },
};
