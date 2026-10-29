import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Switch } from '@weasel-js/ui/components/Switch';

const meta: Meta<typeof Switch> = {
  title: 'ui/Foundations/Switch',
  component: Switch,
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Basic: Story = { args: { children: 'Wifi' } };
export const DefaultOn: Story = { args: { children: 'Bluetooth', defaultSelected: true } };
export const Disabled: Story = { args: { children: 'Locked', isDisabled: true, defaultSelected: true } };

export const Controlled: Story = {
  render: (args) => {
    const [v, setV] = useState(false);
    return <Switch {...args} isSelected={v} onChange={setV}>state = {String(v)}</Switch>;
  },
};
