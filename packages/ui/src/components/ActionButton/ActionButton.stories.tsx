import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ActionButton, FormScope, type ActionButtonProps } from '@weasel-js/ui/components/ActionButton';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Icon } from '@weasel-js/ui/components/Icon';
import { ToolGroup } from '@weasel-js/ui/components/ToolGroup';
import { RunScope } from '@weasel-js/ui/components/Run';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ActionButton> = {
  title: 'ui/ActionButton',
  component: ActionButton,
  args: {
    icon: <Icon name={icon('core:undo')} size={16} />,
    label: 'Undo',
    shortcut: '⌘Z',
    onPress: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof ActionButton>;

function Neighbors(args: ActionButtonProps) {
  return (
    <>
      <ActionButton {...args} />
      <ActionButton icon={<Icon name={icon('core:redo')} size={16} />} label="Redo" shortcut="⇧⌘Z" onPress={() => {}} />
    </>
  );
}

/** A bar's cell: the icon alone, the label and shortcut in its tooltip. */
export const InABar: Story = {
  render: (args) => <Bar label="History" framed><Neighbors {...args} /></Bar>,
};

/** `labeled` reads the label beside the icon; a button with no icon reads it regardless. */
export const Labeled: Story = {
  render: (args) => (
    <Bar label="History" framed>
      <ActionButton {...args} labeled />
      <ActionButton label="Save" onPress={() => {}} />
      <ActionButton label="Discard" grade="danger" onPress={() => {}} />
    </Bar>
  ),
};

/** With `active` it is a toggle, held down while on. */
export const Toggle: Story = {
  render: function ToggleStory(args) {
    const [on, setOn] = useState(true);
    return (
      <Bar label="View" framed>
        <ActionButton {...args} icon={<Icon name={icon('grid')} size={16} />} label="Grid" shortcut={undefined} active={on} onPress={() => setOn((v) => !v)} />
      </Bar>
    );
  },
};

/** Disabled with a reason, it stays reachable and its tooltip reads why. */
export const DisabledWithReason: Story = {
  args: { disabled: true, disabledReason: 'Nothing to undo' },
  render: (args) => <Bar label="History" framed><Neighbors {...args} /></Bar>,
};

/** A menu's row, as a bar's overflow draws it: icon, label, and shortcut across the row. */
export const MenuRow: Story = {
  render: (args) => <FormScope form="menu"><Neighbors {...args} /></FormScope>,
};

/** A form's row: icon and label once, across the row. */
export const Row: Story = {
  render: (args) => <ActionButton {...args} form="row" />,
};

/** A palette's tool, as a `ToolGroup` draws it: the label and shortcut under the icon. `active` is the current tool. */
export const Palette: Story = {
  render: function PaletteStory(args) {
    const [tool, setTool] = useState('undo');
    return (
      <RunScope orientation="vertical">
        <ToolGroup aria-label="Tools">
          <ActionButton {...args} active={tool === 'undo'} onPress={() => setTool('undo')} />
          <ActionButton icon={<Icon name={icon('core:redo')} size={16} />} label="Redo" shortcut="⇧⌘Z" active={tool === 'redo'} onPress={() => setTool('redo')} />
        </ToolGroup>
      </RunScope>
    );
  },
};
