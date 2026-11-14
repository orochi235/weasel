import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Icon } from '@weasel-js/ui/components/Icon';
import { Bar, BarButton } from '@weasel-js/ui/components/Bar';
import { icon } from '../../icons.gen';

const meta: Meta<typeof BarButton> = {
  title: 'ui/Bar/BarButton',
  component: BarButton,
  args: { disabled: false },
};
export default meta;

type Story = StoryObj<typeof BarButton>;

/** A ghost button at the bar's height. Its `title` is the tooltip, and the shortcut follows the name in it. */
export const Default: Story = {
  render: (args) => (
    <Bar label="History">
      <BarButton {...args} title="Undo" shortcut="⌘Z" onClick={() => {}}>Undo</BarButton>
      <BarButton {...args} title="Discard" grade="danger" onClick={() => {}}>Discard</BarButton>
    </Bar>
  ),
};

/** `iconOnly` makes it square around one glyph, named by its `title`. */
export const IconOnly: Story = {
  render: (args) => (
    <Bar label="History">
      <BarButton {...args} iconOnly title="Undo" onClick={() => {}}><Icon name={icon('core:undo')} size={16} /></BarButton>
      <BarButton {...args} iconOnly title="Redo" onClick={() => {}}><Icon name={icon('core:redo')} size={16} /></BarButton>
    </Bar>
  ),
};

/** With `pressed` it is a toggle, held down while on. */
export const Toggle: Story = {
  render: (args) => {
    const [on, setOn] = useState(true);
    return (
      <Bar label="View">
        <BarButton {...args} title="Grid" pressed={on} onClick={() => setOn((v) => !v)}>Grid</BarButton>
      </Bar>
    );
  },
};
