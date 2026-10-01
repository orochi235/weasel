import type { Meta, StoryObj } from '@weasel-js/forge';
import { useMemo, useState } from 'react';
import { isAuto } from '../config/auto';
import { f } from '../config/builder';
import { valueAtPath, withValueAtPath } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';
import { ControlPanel } from './ControlPanel';
import './ControlMatrix.stories.less';

const meta: Meta<typeof ControlMatrix> = {
  title: 'labkit/Controls/ControlMatrix',
  component: ControlMatrix,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlMatrix>;

const look = () => ({
  background: f.boolean(true).describe('Paint the box behind the primitive.'),
  fill: f.color('#2f5d8a'),
  border: f.number(1).range(0, 4).step(0.5).input().suffix('px'),
  shading: f.enum('flat', [
    { value: 'flat', label: 'Flat' },
    { value: 'soft', label: 'Soft' },
    { value: 'bevel', label: 'Bevel' },
  ]),
  glow: f.number(0).range(0, 1).step(0.05).describe('Halo strength around the primitive.'),
});

const primitives = ['window', 'page', 'slab', 'row', 'tile', 'arrow'] as const;
const LOOK_KEYS = Object.keys(look()) as (keyof ReturnType<typeof look>)[];

const config = f.schema({
  looks: f.group({
    defaults: f.group(look()),
    window: f.group(look()),
    page: f.group(look()),
    slab: f.group(look()),
    row: f.group(look()),
    tile: f.group(look()),
    // An arrow is a line: it has nothing to fill and no box behind it.
    arrow: f.group({ border: look().border, shading: look().shading, glow: look().glow }),
  }),
});

const columns: ControlMatrixColumn[] = [
  { key: 'looks.defaults', label: 'Def', title: 'Defaults' },
  { key: 'looks.window', label: 'Win', title: 'Window' },
  { key: 'looks.page', label: 'Page', title: 'Page' },
  { key: 'looks.slab', label: 'Slab', title: 'Slab' },
  { key: 'looks.row', label: 'Row', title: 'Row' },
  { key: 'looks.tile', label: 'Tile', title: 'Tile' },
  { key: 'looks.arrow', label: 'Arr', title: 'Arrow' },
];
const rows = LOOK_KEYS.map((key) => ({ key }));

/**
 * The store the consumer keeps: Defaults always, a primitive's setting only
 * once it is pinned. A missing value inherits.
 */
function useLooks() {
  const schema = useMemo(() => resolveConfigSchema(config, []), []);
  const [stored, setStored] = useState<Record<string, unknown>>(() => ({
    looks: {
      defaults: config.defaults().looks.defaults,
      window: { fill: '#6b3f8f', glow: 0.35 },
      arrow: { border: 2 },
    },
  }));
  const autoPaths = new Set<string>();
  let shown: Record<string, unknown> = stored;
  for (const p of primitives) {
    for (const key of LOOK_KEYS) {
      const path = `looks.${p}.${key}`;
      if (valueAtPath(stored, path) !== undefined) continue;
      autoPaths.add(path);
      shown = withValueAtPath(shown, path, valueAtPath(stored, `looks.defaults.${key}`));
    }
  }
  const setConfig = (path: string, value: unknown) =>
    setStored((prev) => withValueAtPath(prev, path, isAuto(value) ? undefined : value));
  return { schema, shown, autoPaths, setConfig };
}

/** Six primitives and their Defaults in a 360px sidebar. Click a cell to edit
 *  it, Option-click a pinned one to hand it back to Defaults. */
export const Looks: Story = {
  render: function Render() {
    const { schema, shown, autoPaths, setConfig } = useLooks();
    const [focused, setFocused] = useState<string | null>(null);
    return (
      <div className="lk-control-matrix-story">
        <ControlMatrix
          title="Looks"
          schema={schema}
          columns={columns}
          rows={rows}
          config={shown}
          auto={autoPaths}
          setConfig={setConfig}
          onColumnClick={(c) => setFocused(c.title ?? c.label)}
        />
        {focused ? <p className="lk-control-matrix-story__note">Clicked {focused}</p> : null}
      </div>
    );
  },
};

/** The matrix under the panel it sits beside, to check the two read as one family. */
export const BesideControlPanel: Story = {
  render: function Render() {
    const { schema, shown, autoPaths, setConfig } = useLooks();
    return (
      <div className="lk-control-matrix-story">
        <ControlPanel
          title="Defaults"
          schema={resolveConfigSchema(f.schema(look()), [])}
          config={valueAtPath(shown, 'looks.defaults') as Record<string, unknown>}
          setConfig={(path, value) => setConfig(`looks.defaults.${path}`, value)}
        />
        <ControlMatrix
          title="Per primitive"
          schema={schema}
          columns={columns}
          rows={rows}
          config={shown}
          auto={autoPaths}
          setConfig={setConfig}
        />
      </div>
    );
  },
};
