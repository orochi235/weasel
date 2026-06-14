import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToolGroup } from './ToolGroup';
import { ToolButton } from '../ToolButton';

function Dot() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="10" r="4" />
    </svg>
  );
}

const sampleButtons = (
  <>
    <ToolButton icon={<Dot />} label="One" onClick={() => {}} />
    <ToolButton icon={<Dot />} label="Two" onClick={() => {}} />
    <ToolButton icon={<Dot />} label="Three" onClick={() => {}} />
  </>
);

const meta: Meta<typeof ToolGroup> = {
  title: 'weasel-ui/ToolGroup',
  component: ToolGroup,
  args: { children: sampleButtons },
};
export default meta;

type Story = StoryObj<typeof ToolGroup>;

export const Vertical: Story = {};
export const Horizontal: Story = { args: { orientation: 'horizontal' } };
export const Labeled: Story = {
  args: { groupKey: 'shape', ariaLabel: 'Shape tools' },
};
