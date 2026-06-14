import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Select, SelectItem } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

const COLORS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
];

export const OptionsArray: Story = {
  render: () => <Select label="Color" options={COLORS} placeholder="Pick one" />,
};

export const ExplicitChildren: Story = {
  render: () => (
    <Select label="Color" defaultSelectedKey="g">
      <SelectItem id="r">Red</SelectItem>
      <SelectItem id="g">Green</SelectItem>
      <SelectItem id="b" isDisabled>Blue (unavailable)</SelectItem>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => <Select label="Color" options={COLORS} defaultSelectedKey="r" isDisabled />,
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState<string>('r');
      return (
        <Select<string>
          label={`Color (= ${v})`}
          options={COLORS}
          selectedKey={v}
          onSelectionChange={setV}
        />
      );
    }
    return <Wrap />;
  },
};
