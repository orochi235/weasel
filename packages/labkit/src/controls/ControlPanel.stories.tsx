import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import type { ConfigRule, ControlRenderer } from '../config/types';
import { PropertyRow } from '../ui/properties/PropertyPanel';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

const meta: Meta<typeof ControlPanel> = {
  title: 'labkit/Controls/ControlPanel',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlPanel>;

const allFields: ConfigField[] = [
  {
    key: 'frequency',
    label: 'Frequency',
    type: 'slider',
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 2,
  },
  {
    key: 'amplitude',
    label: 'Amplitude',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
  { key: 'showGrid', label: 'Show grid', type: 'checkbox', default: true },
  {
    key: 'wave',
    label: 'Wave',
    type: 'select',
    default: 'sine',
    options: [
      { value: 'sine', label: 'Sine' },
      { value: 'square', label: 'Square' },
      { value: 'triangle', label: 'Triangle' },
    ],
  },
  { key: 'samples', label: 'Samples', type: 'number', default: 256, min: 16, max: 4096, step: 16 },
  { key: 'title', label: 'Title', type: 'text', default: 'My experiment', placeholder: 'Title…' },
  { key: 'tint', label: 'Tint', type: 'color', default: '#3a86ff' },
];

function Harness({ fields }: { fields: ConfigField[] }) {
  const initial: Record<string, unknown> = {};
  for (const f of fields) initial[f.key] = f.default;
  const [config, setConfig] = useState<Record<string, unknown>>(initial);
  return (
    <ControlPanel
      fields={fields}
      config={config}
      setConfig={(key, value) => setConfig((prev) => ({ ...prev, [key as string]: value }))}
    />
  );
}

export const Default: Story = {
  render: () => <Harness fields={allFields} />,
};

export const Minimal: Story = {
  render: () => (
    <Harness
      fields={[
        { key: 'speed', label: 'Speed', type: 'slider', min: 0, max: 10, default: 5 },
        { key: 'enabled', label: 'Enabled', type: 'checkbox', default: true },
      ]}
    />
  ),
};

const sectioned = f.schema({
  showGrid: f.boolean(true),
  cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  seed: f.number(1).section('Advanced'),
  jitter: f.number(0).range(0, 1).step(0.05).section('Advanced'),
  label: f.string('untitled').section('Advanced').placeholder('name this run'),
  offset: f.custom('vector2', { x: 0, y: 0 }).section('Advanced').label('Offset'),
});

function SchemaHarness({
  rules = [],
  renderers,
}: {
  rules?: readonly ConfigRule[];
  renderers?: Record<string, ControlRenderer>;
}) {
  const schema = resolveConfigSchema(sectioned, rules);
  const [config, setConfig] = useState<Record<string, unknown>>(sectioned.defaults());
  return (
    <ControlPanel
      schema={schema}
      config={config}
      setConfig={(key, value) => setConfig((prev) => ({ ...prev, [key as string]: value }))}
      renderers={renderers}
    />
  );
}

/** Sections, and a kind no control is registered for — the placeholder names
 *  the gap rather than dropping the row. */
export const Sections: Story = {
  render: () => <SchemaHarness />,
};

/** The same schema with a control supplied for `vector2`. */
export const CustomControl: Story = {
  render: () => (
    <SchemaHarness
      renderers={{
        vector2: ({ pref, value, setValue }) => {
          const v = value as { x: number; y: number };
          return (
            <PropertyRow label={(pref as { name: string }).name}>
              <input
                type="number"
                value={v.x}
                onChange={(e) => setValue({ ...v, x: Number(e.target.value) })}
              />
              <input
                type="number"
                value={v.y}
                onChange={(e) => setValue({ ...v, y: Number(e.target.value) })}
              />
            </PropertyRow>
          );
        },
      }}
    />
  ),
};

const described = f.schema({
  frequency: f
    .number(2)
    .range(0.1, 10)
    .step(0.1)
    .describe('Cycles per second the oscillator runs at.'),
  amplitude: f.number(0.5).range(0, 1).step(0.05),
  showGrid: f.boolean(true).describe('Draw the alignment grid behind the plot.'),
  wave: f
    .enum('sine', [
      { value: 'sine', label: 'Sine' },
      { value: 'square', label: 'Square' },
    ])
    .describe('Waveform the generator emits.'),
  title: f.string('My experiment'),
  tint: f.color('#3a86ff').describe('Plot line color.'),
});

/** A leaf with a `describe(...)` gets an \u24d8 beside its label whose tooltip
 *  carries the text; leaves without one stay bare. */
export const Described: Story = {
  render: () => {
    const schema = resolveConfigSchema(described, []);
    const [config, setConfig] = useState<Record<string, unknown>>(described.defaults());
    return (
      <ControlPanel
        schema={schema}
        config={config}
        setConfig={(key, value) => setConfig((prev) => ({ ...prev, [key as string]: value }))}
      />
    );
  },
};

const conditional = f.schema({
  showGrid: f.boolean(true),
  cellSize: f
    .number(20)
    .range(5, 80)
    .step(5)
    .label('Grid spacing')
    .showIf((c) => c.showGrid === true),
});

/** `showIf` hides the row while the value stays in config. Toggle the
 *  checkbox to watch the slider come and go. */
export const Conditional: Story = {
  render: () => {
    const schema = resolveConfigSchema(conditional, []);
    const [config, setConfig] = useState<Record<string, unknown>>(conditional.defaults());
    return (
      <ControlPanel
        schema={schema}
        config={config}
        setConfig={(key, value) => setConfig((prev) => ({ ...prev, [key as string]: value }))}
      />
    );
  },
};
