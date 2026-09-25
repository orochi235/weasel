import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { LayerList, type LayerListItem, moveLayers } from '../LayerList';
import { Subpanel } from './Subpanel';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  type PropertyListPack,
  PropertyPanel,
  PropertyRow,
  PropertySpan,
  SelectRow,
  SliderRow,
  TextRow,
  ToggleRow,
} from './PropertyPanel';
import { Switch } from '../Switch';

// Args common to most stories — exposed as controls so the
// title, pack mode, and container width can be tweaked live.
interface DemoArgs {
  title: string;
  pack: PropertyListPack;
  width: number;
}

const meta: Meta<DemoArgs> = {
  title: 'ui/Properties/PropertyPanel',
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

/** `actions` sits on the title row's trailing edge. A `debug` panel is
 *  selectable by default, so the ids below can be dragged over and copied. */
export const HeaderActionsAndSelection: Story = {
  render: function Render() {
    const [unhandled, setUnhandled] = useState(false);
    return (
      <div style={{ width: 320 }}>
        <PropertyPanel
          stance="debug"
          title="Dispatch · 3"
          actions={<Switch isSelected={unhandled} onChange={setUnhandled}>unhandled</Switch>}
        >
          <PropertyList>
            <PropertyRow label="tool">editor.rect</PropertyRow>
            <PropertyRow label="action">insert</PropertyRow>
            <PropertyRow label="target">node:7f3a2c</PropertyRow>
          </PropertyList>
        </PropertyPanel>
      </div>
    );
  },
};

// ── A sidebar of panels ──────────────────────────────────────────────
// Rebuilt from a speech-balloon editor's side panels: readouts with units and
// alpha, two-per-row bodies, and a subpanel for a shape's own parameters.

function BodyPanel() {
  const [base, setBase] = useState<'rectangle' | 'oval' | 'polygon' | 'cloud'>('rectangle');
  const [width, setWidth] = useState(220);
  const [height, setHeight] = useState(140);
  const [lean, setLean] = useState(0);
  const [textColor, setTextColor] = useState('#e6e7ec');
  const [textAlpha, setTextAlpha] = useState(1);

  return (
    <PropertyPanel title={`Body — ${base}`}>
      <PropertyList>
        <SelectRow
          label="Base shape"
          value={base}
          onChange={(v) => setBase(v as typeof base)}
          options={[
            { value: 'rectangle', label: 'rectangle' },
            { value: 'oval', label: 'oval' },
            { value: 'polygon', label: 'polygon' },
            { value: 'cloud', label: 'cloud' },
          ]}
        />
        <SliderRow
          label="Width"
          value={width}
          min={60}
          max={500}
          step={2}
          unit="px"
          onChange={setWidth}
        />
        <SliderRow
          label="Height"
          value={height}
          min={20}
          max={500}
          step={2}
          unit="px"
          onChange={setHeight}
        />
        <SliderRow
          label="Italic lean"
          value={lean}
          min={-25}
          max={25}
          step={0.5}
          unit={<sup>°</sup>}
          onChange={setLean}
        />
        <ColorRow
          label="Text color"
          value={textColor}
          onChange={setTextColor}
          alpha={textAlpha}
          onAlphaChange={setTextAlpha}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

// A single tail's editor body — demonstrates pack='pairs' + a Subpanel
// divider for the shape-specific section (e.g. Bubbles parameters).
function TailBody() {
  const [shape, setShape] = useState<'classic' | 'bubbles' | 'lightning' | 'wavy'>('bubbles');
  const [angle, setAngle] = useState(115);
  const [outAngle, setOutAngle] = useState(0);
  const [arc, setArc] = useState(0);
  const [size, setSize] = useState(60);
  const [bubbleDiameter, setBubbleDiameter] = useState(30);
  const [count, setCount] = useState(3);
  const [gap, setGap] = useState(0.15);
  const [radial, setRadial] = useState(0);

  return (
    <PropertyList pack="pairs">
      <SelectRow
        label="Shape"
        value={shape}
        onChange={(v) => setShape(v as typeof shape)}
        options={[
          { value: 'classic', label: 'classic' },
          { value: 'bubbles', label: 'bubbles' },
          { value: 'lightning', label: 'lightning' },
          { value: 'wavy', label: 'wavy' },
        ]}
      />
      <SliderRow
        label="Angle"
        value={angle}
        min={0}
        max={359}
        unit={<sup>°</sup>}
        onChange={setAngle}
      />
      <SliderRow
        label="Tip angle"
        value={outAngle}
        min={-90}
        max={90}
        unit={<sup>°</sup>}
        onChange={setOutAngle}
      />
      <SliderRow
        label="Bend"
        value={arc}
        min={-1}
        max={1}
        step={0.02}
        format={(v) => v.toFixed(2)}
        onChange={setArc}
      />
      <SliderRow
        label="Length"
        value={size}
        min={8}
        max={220}
        step={0.5}
        unit="px"
        onChange={setSize}
      />
      {shape === 'bubbles' && (
        <Subpanel title="Bubbles">
          <SliderRow
            label="Size"
            value={bubbleDiameter}
            min={8}
            max={120}
            unit="px"
            onChange={setBubbleDiameter}
          />
          <SliderRow label="Count" value={count} min={1} max={8} onChange={setCount} />
          <SliderRow
            label="Gap"
            value={gap}
            min={-1}
            max={1}
            step={0.02}
            format={(v) => v.toFixed(2)}
            onChange={setGap}
          />
          <SliderRow
            label="Base distance"
            value={radial}
            min={-60}
            max={60}
            step={0.5}
            unit="px"
            onChange={setRadial}
          />
        </Subpanel>
      )}
    </PropertyList>
  );
}

function StrokePanel() {
  const [width, setWidth] = useState(2);
  const [color, setColor] = useState('#161921');
  const [alpha, setAlpha] = useState(1);
  return (
    <PropertyPanel title="Stroke">
      <PropertyList pack="pairs">
        <SliderRow
          label="Width"
          value={width}
          min={0.5}
          max={12}
          step={0.5}
          unit="px"
          format={(v) => v.toFixed(1)}
          onChange={setWidth}
        />
        <ColorRow
          label="Color"
          value={color}
          onChange={setColor}
          alpha={alpha}
          onAlphaChange={setAlpha}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

function ShadowPanel() {
  const [dx, setDx] = useState(4);
  const [dy, setDy] = useState(8);
  const [blur, setBlur] = useState(10);
  const [opacity, setOpacity] = useState(0.4);
  const [enabled, setEnabled] = useState(true);
  return (
    <PropertyPanel title="Shadow">
      <PropertyList pack="pairs">
        <PropertySpan>
          <CheckboxRow label="Enabled" value={enabled} onChange={setEnabled} />
        </PropertySpan>
        <SliderRow
          label="Offset X"
          value={dx}
          min={-20}
          max={20}
          step={0.5}
          unit="px"
          format={(v) => v.toFixed(1)}
          onChange={setDx}
        />
        <SliderRow
          label="Offset Y"
          value={dy}
          min={-20}
          max={20}
          step={0.5}
          unit="px"
          format={(v) => v.toFixed(1)}
          onChange={setDy}
        />
        <SliderRow
          label="Blur"
          value={blur}
          min={0}
          max={30}
          step={0.5}
          unit="px"
          format={(v) => v.toFixed(1)}
          onChange={setBlur}
        />
        <SliderRow
          label="Opacity"
          value={opacity}
          min={0}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={setOpacity}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

/** Panels stacked as an editor's sidebar: units on the readouts, a color with
 *  alpha, `pack="pairs"` bodies, and a checkbox spanning a paired grid. */
export const Sidebar: Story = {
  render: () => (
    <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <BodyPanel />
      <StrokePanel />
      <ShadowPanel />
    </div>
  ),
};

/**
 * A panel of like items, each a group that reorders, folds and goes away: a
 * `LayerList` of cards inside the panel. Each tail takes the next tone of the theme's
 * list, which colors its edge and handle and every control inside it, and its
 * ordinal is its handle. Its body pairs its rows and gives the shape's own
 * parameters a `Subpanel`.
 */
export const ToneList: Story = {
  render: () => {
    function Tails() {
      const [tails, setTails] = useState<LayerListItem[]>([
        { id: '1', label: 'classic', tone: 0 },
        { id: '2', label: 'bubbles', tone: 1 },
        { id: '3', label: 'wavy', tone: 2 },
      ]);
      const numbered = tails.map((tail, i) => ({ ...tail, badge: String(i + 1) }));
      return (
        <PropertyPanel title="Tails">
          <LayerList
            items={numbered}
            onReorder={(move) => setTails(moveLayers(tails, move))}
            onRemove={(id) => setTails(tails.filter((t) => t.id !== id))}
            renderBody={() => <TailBody />}
          />
        </PropertyPanel>
      );
    }
    return (
      <div style={{ width: 360 }}>
        <Tails />
      </div>
    );
  },
};
