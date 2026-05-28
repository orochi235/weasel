import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ColorRow, PropertyList } from './PropertyPanel';

const meta: Meta<typeof ColorRow> = {
  title: 'UI/Properties/Rows/ColorRow',
  component: ColorRow,
};
export default meta;
type Story = StoryObj<typeof ColorRow>;

function One({ initial, label }: { initial: string; label: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 280 }}>
      <ColorRow label={label} value={value} onChange={setValue} />
    </div>
  );
}

export const Single: Story = {
  render: () => <One initial="#b08adb" label="Fill" />,
};

function Pair() {
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  return (
    <div style={{ width: 320 }}>
      <PropertyList>
        <ColorRow label="Fill" value={fill} onChange={setFill} />
        <ColorRow label="Stroke" value={stroke} onChange={setStroke} />
      </PropertyList>
    </div>
  );
}

export const PairInList: Story = {
  render: () => <Pair />,
};
