import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Basic: Story = {
  args: { label: 'Name', placeholder: 'e.g. Pico' },
};

export const WithDescription: Story = {
  args: { label: 'Width', description: 'In document units.', defaultValue: '120' },
};

export const Invalid: Story = {
  args: { label: 'Name', isInvalid: true, errorMessage: 'Name is required.' },
};

export const Disabled: Story = {
  args: { label: 'Name', isDisabled: true, defaultValue: 'Pico' },
};

export const Adornments: Story = {
  args: {
    label: 'Size',
    leadingAdornment: <span>W</span>,
    trailingAdornment: <span>px</span>,
    defaultValue: '120',
  },
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState('');
      return <Input label="Q" value={v} onChange={setV} description={`value="${v}"`} />;
    }
    return <Wrap />;
  },
};
