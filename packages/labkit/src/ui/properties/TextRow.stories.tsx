import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TextRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof TextRow> = {
  title: 'UI/Properties/Rows/TextRow',
  component: TextRow,
};
export default meta;
type Story = StoryObj<typeof TextRow>;

function Controlled({
  initial,
  label,
  placeholder,
  maxLength,
  layout,
}: {
  initial: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  layout?: 'block' | 'inline';
}) {
  const [value, setValue] = useState(initial);
  return (
    <TextRow
      label={label}
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      maxLength={maxLength}
      layout={layout}
    />
  );
}

export const BothLayouts: Story = {
  render: () => (
    <SideBySide
      block={<Controlled initial="Untitled" label="Name" />}
      inline={<Controlled initial="Untitled" label="Name" layout="inline" />}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Controlled initial="" label="Name" placeholder="Type a name…" />
    </div>
  ),
};

export const Capped: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Controlled initial="ABCD" label="Tag" maxLength={4} />
    </div>
  ),
};
