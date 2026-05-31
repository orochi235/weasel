import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RadioGroup, Radio } from './RadioGroup';

const meta: Meta<typeof RadioGroup> = {
  title: 'Primitives/RadioGroup',
  component: RadioGroup,
};
export default meta;

type Story = StoryObj<typeof RadioGroup>;

export const Vertical: Story = {
  render: () => (
    <RadioGroup label="Snap mode" defaultValue="grid">
      <Radio value="off">Off</Radio>
      <Radio value="grid">Grid</Radio>
      <Radio value="pixel">Pixel</Radio>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup label="Snap mode" orientation="horizontal" defaultValue="grid">
      <Radio value="off">Off</Radio>
      <Radio value="grid">Grid</Radio>
      <Radio value="pixel">Pixel</Radio>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup label="Snap mode" isDisabled defaultValue="grid">
      <Radio value="off">Off</Radio>
      <Radio value="grid">Grid</Radio>
      <Radio value="pixel">Pixel</Radio>
    </RadioGroup>
  ),
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState('grid');
      return (
        <RadioGroup label={`Snap (= ${v})`} value={v} onChange={setV}>
          <Radio value="off">Off</Radio>
          <Radio value="grid">Grid</Radio>
          <Radio value="pixel">Pixel</Radio>
        </RadioGroup>
      );
    }
    return <Wrap />;
  },
};
