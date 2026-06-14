import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ComboBox, ComboBoxItem } from './ComboBox';

const meta: Meta<typeof ComboBox> = {
  title: 'Primitives/ComboBox',
  component: ComboBox,
};
export default meta;

type Story = StoryObj<typeof ComboBox>;

const COLORS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
  { value: 'k', label: 'Black' },
  { value: 'w', label: 'White' },
];

export const OptionsArray: Story = {
  render: () => <ComboBox label="Color" options={COLORS} placeholder="Type to filter…" />,
};

export const ExplicitChildren: Story = {
  render: () => (
    <ComboBox label="Color" defaultSelectedKey="g">
      <ComboBoxItem id="r">Red</ComboBoxItem>
      <ComboBoxItem id="g">Green</ComboBoxItem>
      <ComboBoxItem id="b" isDisabled>Blue (unavailable)</ComboBoxItem>
    </ComboBox>
  ),
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState<string | null>('r');
      return (
        <ComboBox<string>
          label={`Color (= ${v ?? '∅'})`}
          options={COLORS}
          selectedKey={v}
          onSelectionChange={setV}
        />
      );
    }
    return <Wrap />;
  },
};
