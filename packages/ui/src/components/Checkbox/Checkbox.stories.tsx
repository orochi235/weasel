import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Basic: Story = { args: { children: 'Snap to grid' } };
export const DefaultChecked: Story = { args: { children: 'Visible', defaultSelected: true } };
export const Indeterminate: Story = { args: { children: 'Mixed', isIndeterminate: true } };
export const Disabled: Story = { args: { children: 'Locked', isDisabled: true, defaultSelected: true } };

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState(false);
      return <Checkbox isSelected={v} onChange={setV}>state = {String(v)}</Checkbox>;
    }
    return <Wrap />;
  },
};
