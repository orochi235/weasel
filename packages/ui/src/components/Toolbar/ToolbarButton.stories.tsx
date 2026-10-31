import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Icon } from '@weasel-js/ui/components/Icon';
import { Toolbar, ToolbarButton } from '@weasel-js/ui/components/Toolbar';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ToolbarButton> = {
  title: 'ui/Foundations/Toolbar/ToolbarButton',
  component: ToolbarButton,
  args: { disabled: false },
};
export default meta;

type Story = StoryObj<typeof ToolbarButton>;

/** A ghost button at the toolbar's height. Its `title` is the tooltip, and the shortcut follows the name in it. */
export const Default: Story = {
  render: (args) => (
    <Toolbar aria-label="History">
      <ToolbarButton {...args} title="Undo" shortcut="⌘Z" onClick={() => {}}>Undo</ToolbarButton>
      <ToolbarButton {...args} title="Discard" grade="danger" onClick={() => {}}>Discard</ToolbarButton>
    </Toolbar>
  ),
};

/** `iconOnly` makes it square around one glyph, named by its `title`. */
export const IconOnly: Story = {
  render: (args) => (
    <Toolbar aria-label="History">
      <ToolbarButton {...args} iconOnly title="Undo" onClick={() => {}}><Icon name={icon('core:undo')} size={16} /></ToolbarButton>
      <ToolbarButton {...args} iconOnly title="Redo" onClick={() => {}}><Icon name={icon('core:redo')} size={16} /></ToolbarButton>
    </Toolbar>
  ),
};

/** With `pressed` it is a toggle, held down while on. */
export const Toggle: Story = {
  render: (args) => {
    const [on, setOn] = useState(true);
    return (
      <Toolbar aria-label="View">
        <ToolbarButton {...args} title="Grid" pressed={on} onClick={() => setOn((v) => !v)}>Grid</ToolbarButton>
      </Toolbar>
    );
  },
};
