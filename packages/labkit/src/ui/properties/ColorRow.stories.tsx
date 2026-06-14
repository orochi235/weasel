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

function OneWithAlpha({
  initial,
  initialAlpha,
  label,
  alphaDisabled,
}: {
  initial: string;
  initialAlpha: number;
  label: string;
  alphaDisabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [alpha, setAlpha] = useState(initialAlpha);
  return (
    <div style={{ width: 280 }}>
      <ColorRow
        label={label}
        value={value}
        onChange={setValue}
        alpha={alpha}
        onAlphaChange={setAlpha}
        alphaDisabled={alphaDisabled}
      />
    </div>
  );
}

export const WithAlpha: Story = {
  render: () => <OneWithAlpha initial="#7ec8e3" initialAlpha={0.65} label="Fill" />,
};

export const AlphaDisabled: Story = {
  render: () => (
    <OneWithAlpha initial="#7ec8e3" initialAlpha={1} label="Fill" alphaDisabled />
  ),
};

function AlphaPair() {
  const [fill, setFill] = useState('#b08adb');
  const [fillA, setFillA] = useState(0.8);
  const [stroke, setStroke] = useState('#1a1428');
  const [strokeA, setStrokeA] = useState(0.4);
  return (
    <div style={{ width: 320 }}>
      <PropertyList>
        <ColorRow
          label="Fill"
          value={fill}
          onChange={setFill}
          alpha={fillA}
          onAlphaChange={setFillA}
        />
        <ColorRow
          label="Stroke"
          value={stroke}
          onChange={setStroke}
          alpha={strokeA}
          onAlphaChange={setStrokeA}
        />
      </PropertyList>
    </div>
  );
}

export const AlphaPairInList: Story = {
  render: () => <AlphaPair />,
};
