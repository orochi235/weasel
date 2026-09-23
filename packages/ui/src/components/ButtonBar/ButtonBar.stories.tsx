import type { Meta, StoryObj } from '@weasel-js/forge';
import { ButtonBar, type ButtonBarItem } from './ButtonBar';

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

export const Default: Story = { render: () => <ButtonBar items={items} /> };
export const Minimal: Story = { render: () => <ButtonBar items={items} variant="minimal" /> };

/** `shortcut` shows in each button's tooltip as `Name (key)`. */
export const Tooltips: Story = {
  render: () => (
    <ButtonBar
      items={[
        { value: 'undo', label: 'Undo', shortcut: '⌘Z', onAction: () => console.log('undo') },
        { value: 'redo', label: 'Redo', shortcut: '⇧⌘Z', onAction: () => console.log('redo') },
        { value: 'clear', label: 'Clear', tooltip: 'Remove every mark', onAction: () => console.log('clear') },
      ]}
    />
  ),
};
