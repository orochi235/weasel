import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Primitives/Switch',
  component: Switch,
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Basic: Story = { args: { children: 'Wifi' } };
export const DefaultOn: Story = { args: { children: 'Bluetooth', defaultSelected: true } };
export const Disabled: Story = { args: { children: 'Locked', isDisabled: true, defaultSelected: true } };

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState(false);
      return <Switch isSelected={v} onChange={setV}>state = {String(v)}</Switch>;
    }
    return <Wrap />;
  },
};
