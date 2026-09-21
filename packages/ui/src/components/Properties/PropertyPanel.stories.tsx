import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  type PropertyListPack,
  PropertyPanel,
  PropertyRow,
  SelectRow,
  SliderRow,
  TextRow,
  ToggleRow,
} from './PropertyPanel';

// Args common to most stories — exposed as controls so the
// title, pack mode, and container width can be tweaked live.
interface DemoArgs {
  title: string;
  pack: PropertyListPack;
  width: number;
}

const meta: Meta<DemoArgs> = {
  title: 'weasel-ui/Properties/PropertyPanel',
  argTypes: {
    title: { control: 'text' },
    pack: {
      control: 'inline-radio',
      options: ['auto-color', 'pairs'] satisfies PropertyListPack[],
      description:
        "PropertyList packing. 'auto-color' (default) spans non-color rows full-width; 'pairs' packs every row two-per-row.",
    },
    width: { control: { type: 'number', min: 200, max: 600, step: 10 } },
  },
  args: {
    title: 'Shape',
    pack: 'auto-color',
    width: 320,
  },
};
export default meta;

type Story = StoryObj<DemoArgs>;

function Demo({ title, pack, width }: DemoArgs) {
  const [opacity, setOpacity] = useState(0.65);
  const [radius, setRadius] = useState(12);
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  const [label, setLabel] = useState('Untitled');
  const [visible, setVisible] = useState(true);

  return (
    <div style={{ width }}>
      <PropertyPanel title={title}>
        <PropertyList pack={pack}>
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
            unit="px"
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
  render: (args) => <Demo {...args} />,
};

export const NoTitle: Story = {
  args: { title: '' },
  render: ({ title, width }) => (
    <div style={{ width }}>
      <PropertyPanel title={title || undefined}>
        <PropertyList>
          <SliderRow label="Just a slider" value={50} min={0} max={100} onChange={() => {}} />
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

function AllRowsDemo({ title, pack, width }: DemoArgs) {
  const [opacity, setOpacity] = useState(0.65);
  const [count, setCount] = useState(8);
  const [fill, setFill] = useState('#b08adb');
  const [stroke, setStroke] = useState('#1a1428');
  const [name, setName] = useState('Untitled');
  const [visible, setVisible] = useState(true);
  const [mode, setMode] = useState<'fill' | 'stroke' | 'both'>('both');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');

  return (
    <div style={{ width }}>
      <PropertyPanel title={title}>
        <PropertyList pack={pack}>
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
  args: { title: 'Everything' },
  render: (args) => <AllRowsDemo {...args} />,
};

export const CustomPropertyRow: Story = {
  args: { title: 'Custom row' },
  render: ({ title, pack, width }) => (
    <div style={{ width }}>
      <PropertyPanel title={title}>
        <PropertyList pack={pack}>
          <PropertyRow label="Anything" readout="custom">
            <button type="button">click me</button>
          </PropertyRow>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

export const ListWithoutChrome: Story = {
  // No title — this story explicitly demonstrates rendering without the panel chrome.
  argTypes: { title: { table: { disable: true } } },
  render: ({ pack, width }) => (
    <div style={{ width }}>
      <PropertyList pack={pack}>
        <SliderRow label="Bare" value={50} min={0} max={100} onChange={() => {}} />
        <ColorRow label="Color A" value="#b08adb" onChange={() => {}} />
        <ColorRow label="Color B" value="#1a1428" onChange={() => {}} />
      </PropertyList>
    </div>
  ),
};

const STANCES = [
  undefined,
  'scope',
  'aside',
  'advanced',
  'debug',
  'danger',
  'notice',
  'important',
  'preview',
] as const;

function StanceRows() {
  const [amount, setAmount] = useState(0.4);
  const [on, setOn] = useState(true);
  return (
    <PropertyList>
      <SliderRow label="Amount" value={amount} min={0} max={1} step={0.01} onChange={setAmount} />
      <CheckboxRow label="Enabled" value={on} onChange={setOn} />
    </PropertyList>
  );
}

/** Every stance and none, then tones 0–3 on `scope`, then a panel nested in each. */
export const Stances: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 260px)', gap: 16 }}>
      {STANCES.map((stance) => (
        <PropertyPanel key={stance ?? 'none'} stance={stance} title={stance ?? 'no stance'}>
          <StanceRows />
        </PropertyPanel>
      ))}
      {[0, 1, 2, 3].map((tone) => (
        <PropertyPanel key={`tone-${tone}`} stance="scope" tone={tone} title={`scope, tone ${tone}`}>
          <StanceRows />
        </PropertyPanel>
      ))}
      <PropertyPanel tone={2} title="tone 2, no stance">
        <StanceRows />
      </PropertyPanel>
      {STANCES.filter(Boolean).map((stance) => (
        <PropertyPanel key={`nested-${stance}`} stance="scope" tone={4} title={`${stance} nested in scope`}>
          <PropertyPanel stance={stance} title={stance}>
            <StanceRows />
          </PropertyPanel>
        </PropertyPanel>
      ))}
    </div>
  ),
};
