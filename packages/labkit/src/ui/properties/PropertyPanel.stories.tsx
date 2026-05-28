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

const meta: Meta<typeof PropertyPanel> = {
  title: 'UI/Properties/PropertyPanel',
  component: PropertyPanel,
};
export default meta;

type Story = StoryObj<typeof PropertyPanel>;

function Demo() {
  const [opacity, setOpacity] = useState(0.65);
  const [radius, setRadius] = useState(12);
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  const [label, setLabel] = useState('Untitled');
  const [visible, setVisible] = useState(true);

  return (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Shape">
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
          <SliderRow
            label="Radius"
            value={radius}
            min={0}
            max={64}
            step={1}
            onChange={setRadius}
            format={(v) => `${v}px`}
          />
          <ColorRow label="Fill" value={fill} onChange={setFill} />
          <ColorRow label="Stroke" value={stroke} onChange={setStroke} />
          <TextRow label="Label" value={label} onChange={setLabel} />
          <CheckboxRow label="Visible" value={visible} onChange={setVisible} />
        </PropertyList>
      </PropertyPanel>
    </div>
  );
}

export const Default: Story = {
  render: () => <Demo />,
};

export const NoTitle: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyPanel>
        <PropertyList>
          <SliderRow label="Just a slider" value={50} min={0} max={100} onChange={() => {}} />
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

function AllRowsDemo() {
  const [opacity, setOpacity] = useState(0.65);
  const [count, setCount] = useState(8);
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  const [name, setName] = useState('Untitled');
  const [visible, setVisible] = useState(true);
  const [mode, setMode] = useState<'fill' | 'stroke' | 'both'>('both');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');

  return (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Everything">
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
          <NumberRow label="Count" value={count} onChange={setCount} min={0} max={100} step={1} />
          <ColorRow label="Fill" value={fill} onChange={setFill} />
          <ColorRow label="Stroke" value={stroke} onChange={setStroke} />
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
          <CheckboxRow label="Visible" value={visible} onChange={setVisible} />
        </PropertyList>
      </PropertyPanel>
    </div>
  );
}

export const AllRows: Story = {
  render: () => <AllRowsDemo />,
};

export const CustomPropertyRow: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Custom row">
        <PropertyList>
          <PropertyRow label="Anything" readout="custom">
            <button type="button">click me</button>
          </PropertyRow>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

export const ListWithoutChrome: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyList>
        <SliderRow label="Bare" value={50} min={0} max={100} onChange={() => {}} />
        <ColorRow label="Color A" value="#b08adb" onChange={() => {}} />
        <ColorRow label="Color B" value="#1a1428" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};
