import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { applyConfigWrite } from '../config/autoConfig';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

/**
 * The ghosting and the muted accent are CSS, and jsdom resolves neither
 * `var()` nor `color-mix()`. This story is the only place they can be checked.
 */
const meta: Meta<typeof ControlPanel> = {
  title: 'labkit/Controls/AutoControls',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlPanel>;

const schema = f.schema({
  width: f.number(432).range(64, 1024).label('Width'),
  gap: f
    .number(12)
    .range(0, 48)
    .suffix('px')
    .auto((c) => Math.round((c.width as number) / 24))
    .label('Gap'),
  cols: f.number(3).range(1, 12).label('Columns'),
  wave: f.enum('sine', ['sine', 'square', 'triangle']).label('Wave'),
  mode: f.enum('fit', ['fit', 'fill']).radio().label('Mode'),
  showGrid: f.boolean(true).label('Show grid'),
  title: f.string('My experiment').placeholder('Title…').label('Title'),
  tint: f.color('#3a86ff').label('Tint'),
  seed: f.number(1).range(0, 99).manual().label('Seed'),
});

const resolved = resolveConfigSchema(schema, []);

/** Every path the panel will draw ghosted, except the `.manual()` one. */
const EVERY_AUTO = ['gap', 'cols', 'wave', 'mode', 'showGrid', 'title', 'tint'];

function Panel({ start }: { start: readonly string[] }) {
  const [state, setState] = useState(() => ({
    config: schema.defaults() as Record<string, unknown>,
    autoPaths: start,
  }));
  return (
    <ControlPanel
      schema={resolved}
      config={state.config}
      auto={new Set(state.autoPaths)}
      setConfig={(path, value) =>
        setState((prev) => applyConfigWrite(prev.config, prev.autoPaths, path, value))
      }
    />
  );
}

function Pair() {
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <h3>Pinned</h3>
        <Panel start={[]} />
      </div>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <h3>Auto</h3>
        <Panel start={EVERY_AUTO} />
      </div>
    </div>
  );
}

/**
 * Both states of every row kind, side by side. What to look at: an auto row's
 * control keeps no accent color, its readout reads `auto · 18 px` rather than a
 * number, and the pin dot appears only under the pointer — except on an auto
 * row, where it stays. `Seed` is `.manual()` and takes no dot at all.
 */
export const BothStates: Story = {
  render: () => <Pair />,
};

/** One panel to shift-click around in: the handle must not move as it toggles. */
export const Interactive: Story = {
  render: () => <Panel start={['gap']} />,
};
