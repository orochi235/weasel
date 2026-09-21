import { ANGLE_RADIANS, prefUnit } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyRow, type PrefNumberUnit } from '@weasel-js/ui';
import { useState } from 'react';
import { f } from '../config/builder';
import { withValueAtPath } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import type { ConfigRule, ControlRenderer } from '../config/types';
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
      setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
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
      setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
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
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
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
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
      />
    );
  },
};

const nested = f.schema({
  showGrid: f.boolean(true),
  grid: f
    .group({
      size: f.number(20).range(5, 80).step(5).label('Cell size'),
      color: f.color('#3a86ff'),
    })
    .describe('Written at config.grid.size and config.grid.color.'),
  export: f.group({
    format: f.enum('png', ['png', 'svg']),
    scale: f.number(2).range(1, 4).step(1),
  }),
});

/** `f.group` nests the value as well as the heading: these rows write to
 *  `grid.size` and `export.scale`, not to `size` and `scale`. */
export const Nested: Story = {
  render: () => {
    const schema = resolveConfigSchema(nested, []);
    const [config, setConfig] = useState<Record<string, unknown>>(nested.defaults());
    return (
      <>
        <ControlPanel
          schema={schema}
          config={config}
          setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
        />
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </>
    );
  },
};

const degrees = prefUnit(ANGLE_RADIANS, 'deg', { precision: 1 });

const presentation = f.schema({
  x: f.number(120).label('X').pair('Offset'),
  y: f.number(-40).label('Y').pair('Offset'),
  spin: f
    .number(Math.PI / 4)
    .range(0, Math.PI * 2)
    .unit(degrees)
    .label('Rotation'),
  nudge: f
    .number(Math.PI / 180)
    .input()
    .unit(degrees)
    .label('Nudge'),
  tint: f.color('#3a86ffcc').alpha().label('Tint'),
  opaque: f.color('#3a86ff').label('Grid'),
});

/** The three presentation fields a leaf can declare: `pair` puts `X` and `Y`
 *  on one row the pair names, `unit` stores radians and edits degrees, and
 *  `alpha` gives the swatch an opacity track and stores `#rrggbbaa`. The dump
 *  shows what each control actually wrote. */
export const Presentation: Story = {
  render: () => {
    const schema = resolveConfigSchema(presentation, []);
    const [config, setConfig] = useState<Record<string, unknown>>(presentation.defaults());
    return (
      <>
        <ControlPanel
          schema={schema}
          config={config}
          setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
        />
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </>
    );
  },
};

const inline = f.schema({
  folderPad: f.number(1.1).range(0, 4).step(0.1).label('Folder pad'),
  glyphs: f.number(1_000_000).range(0, 2_000_000).format('compact'),
  names: f.number(60).range(0, 100),
  labels: f.number(0).range(0, 100),
  placement: f.enum('spread', ['spread', 'stack', 'ring']),
  lift: f.number(0.2).range(0, 1).step(0.05),
  opacity: f.number(0.45).range(0, 1).step(0.05),
  iconSet: f.enum('small', ['small', 'large']).label('Icon set'),
  drawAsIcons: f.string('**/node_modules/**').label('Draw as icons'),
  detail: f.number(1200).range(0, 4000).suffix('nodes'),
  showCameraRoute: f.boolean(false).toggle().label('Show camera route'),
  routeColor: f.enum('sweep', ['sweep', 'depth']).label('Route color'),
  minimap: f.boolean(true).toggle(),
  minimapSize: f.number(280).range(80, 600).label('Minimap size'),
  pickHud: f.boolean(true).toggle().label('Pick HUD'),
  pickOutlines: f.boolean(true).toggle().label('Pick outlines'),
  markOverlay: f.boolean(false).toggle().label('Mark overlay'),
});

/** The shape a lab's sidebar draws: `layout="inline"` paired two to a row, in a
 *  narrow column. Every row kind meets here — slider, select, switch, text —
 *  and they have to share one base height, or the column reads as ragged. */
export const Inline: Story = {
  render: () => {
    const schema = resolveConfigSchema(inline, []);
    const [config, setConfig] = useState<Record<string, unknown>>(inline.defaults());
    return (
      <div style={{ width: 360 }}>
        <ControlPanel
          schema={schema}
          config={config}
          setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
          layout="inline"
          align="center"
        />
      </div>
    );
  },
};

const shownIn = (suffix: string): PrefNumberUnit => ({ toDisplay: (v) => v, fromDisplay: (v) => v, suffix });

/** Every slider in astv's right sidebar, for sizing readouts against real ranges, steps and units. */
const sidebarSliders = f.schema({
  aimNoise: f.number(0).range(0, 0.6).step(0.02).label('Aim noise'),
  transition: f.number(600).range(0, 1200).step(50).unit(shownIn('ms')).label('Transition'),
  sweep: f.number(12).range(0, 40).step(0.5).label('Text motion'),
  beat: f.number(1600).range(400, 6000).step(100).unit(shownIn('ms')).label('Beat'),
  tourSeed: f.number(1).range(1, 99).step(1).label('Tour seed'),
  hold: f.number(1200).range(0, 4000).step(10).unit(shownIn('ms')).label('Demo hold'),
  scrollRows: f.number(3).range(1, 12).step(1).label('Lines'),
  pad: f.number(0.5).range(0, 4).step(0.25).label('Window pad'),
  folderPad: f.number(1).range(0, 4).step(0.1).label('Folder pad'),
  levels: f.number(2).range(0, 6).step(1).label('Levels'),
  glyphs: f.number(1_000_000).range(0, 2_000_000).step(2000).format('compact').label('Glyphs'),
  names: f.number(40).range(0, 200).step(5).label('Names'),
  labels: f.number(0).range(0, 30).step(1).label('Labels'),
  text: f.number(100).range(50, 250).step(5).unit(shownIn('%')).label('Text'),
  lift: f.number(0.8).range(0, 4).step(0.1).label('Lift'),
  opacity: f.number(0.6).range(0.1, 1).step(0.05).label('Opacity'),
  detail: f.number(300).range(20, 4000).step(20).label('Nodes'),
  reachStep: f.number(600).range(200, 2000).step(100).unit(shownIn('ms')).label('Reach step'),
  width: f.number(2).range(1, 24).step(0.5).unit(shownIn('px')).label('Width'),
  minimapSize: f.number(280).range(120, 600).step(20).label('Minimap size'),
});

/** astv's sidebar sliders paired two to a row, at the narrowest width a two-up sidebar should support:
 *  300px at compact and comfortable. Roomy needs 352px; at 300 its longest labels push readouts out of the row. */
export const SidebarSliders: Story = {
  render: () => {
    const schema = resolveConfigSchema(sidebarSliders, []);
    const [config, setConfig] = useState<Record<string, unknown>>(sidebarSliders.defaults());
    return (
      <div style={{ width: 300 }}>
        <ControlPanel
          schema={schema}
          config={config}
          setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
          layout="inline"
          align="center"
          pack="pairs"
        />
      </div>
    );
  },
};
