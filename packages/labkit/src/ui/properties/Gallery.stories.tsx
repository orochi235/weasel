import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  PropertyPanel,
  PropertyRow,
  SelectRow,
  SliderRow,
  TextRow,
  ToggleRow,
} from './PropertyPanel';

// Titled "Gallery" so it sorts above PropertyPanel/PropertyList/Rows in the
// sidebar alphabetically (G < P < R). Acts as the visual root of the section.
const meta: Meta = {
  title: 'UI/Properties/Gallery',
};
export default meta;
type Story = StoryObj;

function BlockRows() {
  const [opacity, setOpacity] = useState(0.65);
  const [count, setCount] = useState(8);
  const [name, setName] = useState('Untitled');
  const [mode, setMode] = useState<'fill' | 'stroke' | 'both'>('both');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  return (
    <PropertyPanel title="Block layout (default)">
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
        <NumberRow label="Count" value={count} onChange={setCount} min={0} max={100} />
        <TextRow label="Name" value={name} onChange={setName} />
        <SelectRow
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'fill', label: 'Fill only' },
            { value: 'stroke', label: 'Stroke only' },
            { value: 'both', label: 'Fill + stroke' },
          ]}
        />
        <ToggleRow
          label="Align"
          value={align}
          onChange={setAlign}
          options={[
            { value: 'left', label: 'L' },
            { value: 'center', label: 'C' },
            { value: 'right', label: 'R' },
          ]}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

function InlineRows() {
  const [opacity, setOpacity] = useState(0.5);
  const [count, setCount] = useState(8);
  const [name, setName] = useState('Untitled');
  const [mode, setMode] = useState<'fill' | 'stroke' | 'both'>('both');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  return (
    <PropertyPanel title="Inline layout">
      <PropertyList>
        <SliderRow
          label="Opacity"
          layout="inline"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={setOpacity}
          format={(v) => v.toFixed(2)}
        />
        <NumberRow
          label="Count"
          layout="inline"
          value={count}
          onChange={setCount}
          min={0}
          max={100}
        />
        <TextRow label="Name" layout="inline" value={name} onChange={setName} />
        <SelectRow
          label="Mode"
          layout="inline"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'fill', label: 'Fill only' },
            { value: 'stroke', label: 'Stroke only' },
            { value: 'both', label: 'Fill + stroke' },
          ]}
        />
        <ToggleRow
          label="Align"
          layout="inline"
          value={align}
          onChange={setAlign}
          options={[
            { value: 'left', label: 'L' },
            { value: 'center', label: 'C' },
            { value: 'right', label: 'R' },
          ]}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

function IntrinsicRows() {
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  const [highlight, setHighlight] = useState('#7fb069');
  const [shadow, setShadow] = useState('#000000');
  const [visible, setVisible] = useState(true);
  const [snap, setSnap] = useState(false);
  return (
    <PropertyPanel title="Intrinsic-layout variants">
      <PropertyList>
        <ColorRow label="Fill" value={fill} onChange={setFill} />
        <ColorRow label="Stroke" value={stroke} onChange={setStroke} />
        <ColorRow label="Highlight" value={highlight} onChange={setHighlight} />
        <ColorRow label="Shadow" value={shadow} onChange={setShadow} />
        <CheckboxRow label="Visible" value={visible} onChange={setVisible} />
        <CheckboxRow label="Snap to grid" value={snap} onChange={setSnap} />
      </PropertyList>
    </PropertyPanel>
  );
}

function CustomRows() {
  return (
    <PropertyPanel title="Custom (PropertyRow)">
      <PropertyList>
        <PropertyRow label="Tempo" readout="120 bpm">
          <button type="button">Tap to set</button>
        </PropertyRow>
        <PropertyRow label="Free-form" layout="inline">
          <code style={{ background: 'rgba(0,0,0,0.35)', padding: '2px 6px', borderRadius: 3 }}>
            arbitrary children
          </code>
        </PropertyRow>
      </PropertyList>
    </PropertyPanel>
  );
}

export const All: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        maxWidth: 1100,
      }}
    >
      <BlockRows />
      <InlineRows />
      <IntrinsicRows />
      <CustomRows />
    </div>
  ),
};
