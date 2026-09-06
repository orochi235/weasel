import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  type PropertyAlign,
  type PropertyDensity,
  PropertyList,
  PropertyPanel,
  SliderRow,
  TextRow,
} from './PropertyPanel';

const meta: Meta = {
  title: 'weasel-ui/Properties/Metrics',
};
export default meta;
type Story = StoryObj;

const SWATCHES: ReadonlyArray<readonly [string, string]> = [
  ['Fill', '#4f8ef7'],
  ['Stroke', '#f7a54f'],
  ['Shadow under the shape', '#2b2b34'],
  ['Highlight', '#ffe9a8'],
];

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>{children}</div>;
}

function Palette({ align }: { align?: PropertyAlign }) {
  const [colors, setColors] = useState(SWATCHES.map(([, hex]) => hex));
  const [alpha, setAlpha] = useState(0.7);
  return (
    <PropertyPanel title={align ? `align="${align}"` : 'unset'} className="metrics-palette">
      <PropertyList align={align} pack="one-up">
        {SWATCHES.map(([label], i) => (
          <ColorRow
            key={label}
            label={label}
            value={colors[i]}
            onChange={(next) => setColors((c) => c.map((v, j) => (j === i ? next : v)))}
            // One row carries alpha, so the pair below it shows whether the
            // track still sits on its neighbour's bottom edge.
            alpha={i === 2 ? alpha : undefined}
            onAlphaChange={setAlpha}
          />
        ))}
      </PropertyList>
    </PropertyPanel>
  );
}

/**
 * A column of color rows read as a group. Unset, each row centers its label
 * against its swatch and sinks the pair to the row's bottom edge — which is
 * what keeps an alpha track level with the taller neighbour beside it.
 * `align="start"` puts every swatch on one top edge instead.
 */
export const Align: Story = {
  render: () => (
    <Row>
      <style>{'.metrics-palette { width: 190px }'}</style>
      <Palette />
      <Palette align="baseline" />
      <Palette align="start" />
      <Palette align="center" />
    </Row>
  ),
};

function Sample({ density }: { density?: PropertyDensity }) {
  const [opacity, setOpacity] = useState(0.65);
  const [count, setCount] = useState(8);
  const [name, setName] = useState('Untitled');
  const [locked, setLocked] = useState(true);
  const [color, setColor] = useState('#4f8ef7');
  return (
    <PropertyPanel title={density ? `density="${density}"` : 'unset'} density={density}>
      <PropertyList>
        <SliderRow
          label="Opacity"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={setOpacity}
        />
        <NumberRow label="Count" value={count} onChange={setCount} min={0} max={100} />
        <TextRow label="Name" value={name} onChange={setName} />
        <ColorRow label="Fill" value={color} onChange={setColor} />
        <CheckboxRow label="Locked" value={locked} onChange={setLocked} />
      </PropertyList>
    </PropertyPanel>
  );
}

/** Gaps, padding and field height move together, from one prop on the panel. */
export const Density: Story = {
  render: () => (
    <Row>
      <Sample density="tight" />
      <Sample />
      <Sample density="roomy" />
    </Row>
  ),
};

/**
 * A typed number and its unit. The unit is a sibling of the input, not content
 * inside it — the field's border ends at the digits.
 */
export const NumberUnits: Story = {
  render: () => {
    const [px, setPx] = useState(24);
    const [ms, setMs] = useState(150);
    const [deg, setDeg] = useState(45);
    const [plain, setPlain] = useState(8);
    return (
      <PropertyPanel title="Units sit outside the field">
        <PropertyList>
          <NumberRow label="Radius" value={px} onChange={setPx} unit="px" />
          <NumberRow label="Duration" value={ms} onChange={setMs} unit="ms" />
          <NumberRow label="Angle" value={deg} onChange={setDeg} unit={<sup>°</sup>} />
          <NumberRow label="Count" value={plain} onChange={setPlain} />
        </PropertyList>
      </PropertyPanel>
    );
  },
};

/** `layout` now reaches the color and checkbox rows, which used to ignore it. */
export const VariantLayout: Story = {
  render: () => {
    const [color, setColor] = useState('#4f8ef7');
    const [alpha, setAlpha] = useState(0.8);
    const [locked, setLocked] = useState(true);
    return (
      <Row>
        <PropertyPanel title="unset">
          <PropertyList>
            <ColorRow
              label="Fill"
              value={color}
              onChange={setColor}
              alpha={alpha}
              onAlphaChange={setAlpha}
            />
            <CheckboxRow label="Locked" value={locked} onChange={setLocked} />
          </PropertyList>
        </PropertyPanel>
        <PropertyPanel title='layout="block"'>
          <PropertyList>
            <ColorRow
              label="Fill"
              value={color}
              onChange={setColor}
              alpha={alpha}
              onAlphaChange={setAlpha}
              layout="block"
            />
            <CheckboxRow label="Locked" value={locked} onChange={setLocked} layout="block" />
          </PropertyList>
        </PropertyPanel>
      </Row>
    );
  },
};
