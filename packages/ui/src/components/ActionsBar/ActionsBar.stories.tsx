import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionsBar, type ActionsBarItem } from './ActionsBar';

const meta: Meta<typeof ActionsBar> = {
  title: 'weasel-ui/Foundations/ActionsBar',
  component: ActionsBar,
};

export default meta;
type Story = StoryObj<typeof ActionsBar>;

const items: ActionsBarItem[] = [
  { value: 'undo', label: 'Undo', onAction: () => console.log('undo') },
  { value: 'redo', label: 'Redo', onAction: () => console.log('redo') },
  { value: 'clear', label: 'Clear', onAction: () => console.log('clear') },
];

export const Default: Story = { render: () => <ActionsBar items={items} /> };
export const Minimal: Story = { render: () => <ActionsBar items={items} variant="minimal" /> };
