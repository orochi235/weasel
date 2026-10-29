import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { RadioGroup, Radio } from '@weasel-js/ui/components/RadioGroup';

const meta: Meta<typeof RadioGroup> = {
  title: 'ui/Foundations/RadioGroup',
  component: RadioGroup,
};
export default meta;

type Story = StoryObj<typeof RadioGroup>;

export const Vertical: Story = {
  args: { label: 'Snap mode', defaultValue: 'grid' },
  render: (args) => (
    <RadioGroup {...args}>
      <Radio value="off">Off</Radio>
      <Radio value="grid">Grid</Radio>
      <Radio value="pixel">Pixel</Radio>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  args: { label: 'Snap mode', orientation: 'horizontal', defaultValue: 'grid' },
  render: (args) => (
    <RadioGroup {...args}>
      <Radio value="off">Off</Radio>
      <Radio value="grid">Grid</Radio>
      <Radio value="pixel">Pixel</Radio>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  args: { label: 'Snap mode', isDisabled: true, defaultValue: 'grid' },
  render: (args) => (
    <RadioGroup {...args}>
      <Radio value="off">Off</Radio>
      <Radio value="grid">Grid</Radio>
      <Radio value="pixel">Pixel</Radio>
    </RadioGroup>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    const [v, setV] = useState('grid');
    return (
      <RadioGroup {...args} label={`Snap (= ${v})`} value={v} onChange={setV}>
        <Radio value="off">Off</Radio>
        <Radio value="grid">Grid</Radio>
        <Radio value="pixel">Pixel</Radio>
      </RadioGroup>
    );
  },
};
