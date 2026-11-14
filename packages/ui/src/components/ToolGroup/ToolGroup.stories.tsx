import type { Meta, StoryObj } from '@weasel-js/forge';
import { ToolGroup } from '@weasel-js/ui/components/ToolGroup';
import { ToolButton } from '@weasel-js/ui/components/ToolButton';
import { RunScope } from '@weasel-js/ui/components/Run';

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
  title: 'ui/ToolGroup',
  component: ToolGroup,
  args: { children: sampleButtons },
};
export default meta;

type Story = StoryObj<typeof ToolGroup>;

/** A group reads which way it runs from the run it sits in: a row by default, a column in a vertical one. */
export const Horizontal: Story = {};
export const Vertical: Story = {
  render: (args) => <RunScope orientation="vertical"><ToolGroup {...args} /></RunScope>,
};
export const Labeled: Story = {
  args: { groupKey: 'shape', 'aria-label': 'Shape tools' },
};
