import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { decimal } from '@weasel-js/quantity';
import { PropertyField, PropertyList, PropertyRow } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof PropertyList> = {
  title: 'ui/Properties/PropertyList',
  component: PropertyList,
};
export default meta;
type Story = StoryObj<typeof PropertyList>;

/** Standalone (no chrome) — drop into a sidebar or any container. */
export const Standalone: Story = {
  render: (args) => {
    const [opacity, setOpacity] = useState(0.5);
    const [fill, setFill] = useState('#b08adb');
    const [stroke, setStroke] = useState('#1a1428');
    const [visible, setVisible] = useState(true);
    return (
      <div style={{ width: 320 }}>
        <PropertyList {...args}>
          <PropertyField
            kind="number"
            control="slider"
            label="Opacity"
            value={opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={setOpacity}
            display={decimal({ places: 2 })}
          />
          <PropertyField kind="color" label="Fill" value={fill} onChange={setFill} />
          <PropertyField kind="color" label="Stroke" value={stroke} onChange={setStroke} />
          <PropertyField kind="boolean" label="Visible" hug value={visible} onChange={setVisible} />
        </PropertyList>
      </div>
    );
  },
};

/** Four ColorRows pack into two rows of two via the 2-col grid. */
export const FourColors: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <PropertyList {...args}>
        <PropertyField kind="color" label="A" value="#b08adb" onChange={() => {}} />
        <PropertyField kind="color" label="B" value="#7fb069" onChange={() => {}} />
        <PropertyField kind="color" label="C" value="#e07a5f" onChange={() => {}} />
        <PropertyField kind="color" label="D" value="#74c69d" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};

/** An odd number of ColorRows leaves the trailing cell empty. */
export const ThreeColors: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <PropertyList {...args}>
        <PropertyField kind="color" label="A" value="#b08adb" onChange={() => {}} />
        <PropertyField kind="color" label="B" value="#7fb069" onChange={() => {}} />
        <PropertyField kind="color" label="C" value="#e07a5f" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};

/** A non-color row in the middle breaks color pairing — A pairs with the empty cell. */
export const ColorPairingBrokenBySlider: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <PropertyList {...args}>
        <PropertyField kind="color" label="A" value="#b08adb" onChange={() => {}} />
        <PropertyRow label="Divider">
          <input type="text" defaultValue="full width row" />
        </PropertyRow>
        <PropertyField kind="color" label="B" value="#7fb069" onChange={() => {}} />
        <PropertyField kind="color" label="C" value="#e07a5f" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};

const MODES = [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }];
const ENDS = [{ value: 'butt', label: 'Butt' }, { value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }];

/** Inline rows two to a line in a sidebar. A label that would leave its control less than the control can be used
 *  at — Shift angle step's track, the long-named field, select, and toggle — puts the control under it, its
 *  readout still beside the track; Spacing and Units keep theirs beside the label. */
export const PairsLongLabels: Story = {
  render: (args) => {
    const [spacing, setSpacing] = useState(20);
    const [angle, setAngle] = useState(15);
    const [tolerance, setTolerance] = useState(6);
    const [units, setUnits] = useState('px');
    const [mode, setMode] = useState('px');
    const [ends, setEnds] = useState('round');
    return (
      <div style={{ width: 320 }}>
        <PropertyList pack="pairs" {...args}>
          <PropertyField kind="number" control="slider" layout="inline" label="Spacing" value={spacing} min={5} max={80} step={5} onChange={setSpacing} />
          <PropertyField kind="number" control="slider" layout="inline" label="Shift angle step" value={angle} min={5} max={90} step={5} onChange={setAngle} />
          <PropertyField kind="enum" layout="inline" label="Units" value={units} options={MODES} onChange={setUnits} />
          <PropertyField kind="enum" layout="inline" label="Readout units shown" value={mode} options={MODES} onChange={setMode} />
          <PropertyField kind="number" layout="inline" label="Snap tolerance" value={tolerance} min={0} max={40} onChange={setTolerance} />
          <PropertyField kind="enum" control="toggle" layout="inline" label="Line ends" value={ends} options={ENDS} onChange={setEnds} />
        </PropertyList>
      </div>
    );
  },
};
