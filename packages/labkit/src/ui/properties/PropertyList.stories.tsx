import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  PropertyList,
  PropertyRow,
  SliderRow,
} from './PropertyPanel';

const meta: Meta<typeof PropertyList> = {
  title: 'UI/Properties/PropertyList',
  component: PropertyList,
};
export default meta;
type Story = StoryObj<typeof PropertyList>;

function Mixed() {
  const [opacity, setOpacity] = useState(0.5);
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  const [visible, setVisible] = useState(true);
  return (
    <div style={{ width: 320 }}>
      <PropertyList>
        <SliderRow
          label="Opacity"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={setOpacity}
          format={(v) => v.toFixed(2)}
        />
        <ColorRow label="Fill" value={fill} onChange={setFill} />
        <ColorRow label="Stroke" value={stroke} onChange={setStroke} />
        <CheckboxRow label="Visible" value={visible} onChange={setVisible} />
      </PropertyList>
    </div>
  );
}

/** Standalone (no chrome) — drop into a sidebar or any container. */
export const Standalone: Story = {
  render: () => <Mixed />,
};

/** Four ColorRows pack into two rows of two via the 2-col grid. */
export const FourColors: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyList>
        <ColorRow label="A" value="#b08adb" onChange={() => {}} />
        <ColorRow label="B" value="#7fb069" onChange={() => {}} />
        <ColorRow label="C" value="#e07a5f" onChange={() => {}} />
        <ColorRow label="D" value="#74c69d" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};

/** An odd number of ColorRows leaves the trailing cell empty. */
export const ThreeColors: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyList>
        <ColorRow label="A" value="#b08adb" onChange={() => {}} />
        <ColorRow label="B" value="#7fb069" onChange={() => {}} />
        <ColorRow label="C" value="#e07a5f" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};

/** A non-color row in the middle breaks color pairing — A pairs with the empty cell. */
export const ColorPairingBrokenBySlider: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyList>
        <ColorRow label="A" value="#b08adb" onChange={() => {}} />
        <PropertyRow label="Divider">
          <input type="text" defaultValue="full width row" />
        </PropertyRow>
        <ColorRow label="B" value="#7fb069" onChange={() => {}} />
        <ColorRow label="C" value="#e07a5f" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};
