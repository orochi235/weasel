import type { Meta, StoryObj } from '@weasel-js/forge';
import { Sequence, values } from '@weasel-js/ui/components/Sequence';
import { Focusable, Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof Tooltip> = {
  title: 'ui/Tooltip',
  component: Tooltip,
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Basic: Story = {
  args: { children: 'Duplicates the selected layer' },
  render: (args) => (
    <TooltipTrigger>
      <Focusable>
        <Button>Hover or focus me</Button>
      </Focusable>
      <Tooltip {...args} />
    </TooltipTrigger>
  ),
};

export const Placements: Story = {
  render: (args) => (
    <Sequence label="Placements" sweep={values(['top', 'bottom', 'left', 'right'] as const)} caption={false}>
      {(p) => (
        <TooltipTrigger>
          <Focusable>
            <Button>{p}</Button>
          </Focusable>
          <Tooltip {...args} placement={p}>Placement: {p}</Tooltip>
        </TooltipTrigger>
      )}
    </Sequence>
  ),
};

export const Markdown: Story = {
  args: { children: 'Sets `fill` on **every** stop. A `*` in a glob like *.ts stays as written.' },
  render: Basic.render,
};

export const LongContent: Story = {
  args: {
    children:
      'Boolean operations need at least two path objects selected. Select another shape with Shift-click and try again.',
  },
  render: Basic.render,
};
