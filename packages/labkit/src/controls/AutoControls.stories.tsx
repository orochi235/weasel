import type { Meta, StoryObj } from '@weasel-js/forge';
import { f, resolveConfigSchema } from '@weasel-js/labkit/config';
import { ControlPanel, type ControlPanelProps } from '@weasel-js/labkit/controls';
import { useState } from 'react';
import { applyConfigWrite } from '../config/autoConfig';

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
  cols: f.number(3).range(1, 12).auto().label('Columns'),
  wave: f.enum('sine', ['sine', 'square', 'triangle']).auto().label('Wave'),
  mode: f.enum('fit', ['fit', 'fill']).radio().auto().label('Mode'),
  showGrid: f.boolean(true).auto().label('Show grid'),
  title: f.string('My experiment').placeholder('Title…').auto().label('Title'),
  tint: f.color('#3a86ff').auto().label('Tint'),
  seed: f.number(1).range(0, 99).label('Seed'),
});

const resolved = resolveConfigSchema(schema, []);

/** Every path that said `.auto()`; `Width` and `Seed` did not. */
const EVERY_AUTO = ['gap', 'cols', 'wave', 'mode', 'showGrid', 'title', 'tint'];

function Panel({
  start,
  ...args
}: Partial<ControlPanelProps<Record<string, unknown>>> & { start: readonly string[] }) {
  const [state, setState] = useState(() => ({
    config: schema.defaults() as Record<string, unknown>,
    autoPaths: start,
  }));
  return (
    <ControlPanel
      {...args}
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
 * Both states of every row kind, side by side. What to look at: an auto row
 * shows no control at all — only its label and the word `auto` — and still
 * takes exactly the room it took while pinned, so nothing below it moves on
 * the toggle. `Width` and `Seed` never said `.auto()`, and do not toggle.
 */
export const BothStates: Story = {
  render: () => <Pair />,
};

/** One panel to click labels around in: the row must not resize as it toggles. */
export const Interactive: Story = {
  render: (args) => <Panel {...args} start={['gap']} />,
};
