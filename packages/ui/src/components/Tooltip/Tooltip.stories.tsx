import type { Meta, StoryObj } from '@storybook/react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from './Tooltip';

// NOTE: native <button> triggers wrapped in <Focusable>, not the kit
// <Button> — kit Button doesn't forward react-aria's hover/focus props,
// so Focusable's cloned props would be dropped and the tooltip never open.

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Basic: Story = {
  render: () => (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Hover or focus me</button>
      </Focusable>
      <Tooltip>Duplicates the selected layer</Tooltip>
    </TooltipTrigger>
  ),
};

export const Placements: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {(['top', 'bottom', 'left', 'right'] as const).map((p) => (
        <TooltipTrigger key={p}>
          <Focusable>
            <button type="button">{p}</button>
          </Focusable>
          <Tooltip placement={p}>Placement: {p}</Tooltip>
        </TooltipTrigger>
      ))}
    </div>
  ),
};

export const LongContent: Story = {
  render: () => (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Why is this disabled?</button>
      </Focusable>
      <Tooltip>
        Boolean operations need at least two path objects selected. Select
        another shape with Shift-click and try again.
      </Tooltip>
    </TooltipTrigger>
  ),
};
