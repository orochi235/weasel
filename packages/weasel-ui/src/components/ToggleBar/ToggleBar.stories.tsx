import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleBar } from './ToggleBar';

const meta: Meta<typeof ToggleBar> = {
  title: 'weasel-ui/Foundations/ToggleBar',
  component: ToggleBar,
};

export default meta;
type Story = StoryObj<typeof ToggleBar>;

const alignItems = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

export const Single: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} ariaLabel="Text alignment" />;
  },
};

export const Boolean2Segment: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('on');
    return (
      <ToggleBar
        items={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
        value={v}
        onChange={setV}
        ariaLabel="Power"
      />
    );
  },
};

export const Multiple: Story = {
  render: () => {
    const [v, setV] = useState<string[]>(['b']);
    return (
      <ToggleBar
        mode="multiple"
        items={[
          { value: 'b', label: 'B' },
          { value: 'i', label: 'I' },
          { value: 'u', label: 'U' },
        ]}
        value={v}
        onChange={setV}
        ariaLabel="Text style"
      />
    );
  },
};

export const Disabled: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('a');
    return (
      <ToggleBar
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ]}
        value={v}
        onChange={setV}
      />
    );
  },
};

export const Tall: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} height={32} />;
  },
};

export const AllowDeselect: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} allowDeselect />;
  },
};
