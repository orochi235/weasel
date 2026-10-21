import type { Meta, StoryObj } from '@weasel-js/forge';
import { f, resolveConfigSchema, withValueAtPath } from '@weasel-js/labkit/config';
import { ControlPanel } from '@weasel-js/labkit/controls';
import { useState } from 'react';

const meta: Meta<typeof ControlPanel> = {
  title: 'labkit/Controls/PanelEditing',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlPanel>;

const tuning = f.schema({
  speed: f.number(4).range(0, 10).step(0.5).label('Speed'),
  seed: f.number().min(0).label('Seed'),
  title: f.string('untitled').label('Title'),
  points: f.list([1, 2, 3], f.number(0)).label('Points'),
});
const schema = resolveConfigSchema(tuning, []);
const baseline: Record<string, unknown> = tuning.defaults();

type Config = Record<string, unknown>;

/** Typed edits write once, on Enter or blur, while `draftConfig` follows every
 *  keystroke; Escape drops a text edit. A dialog writes on Done and drops its
 *  draft on Cancel or Escape. The write count is the number of undo steps. */
export const Drafts: Story = {
  render: () => {
    const [config, setConfig] = useState<Config>(baseline);
    const [draft, setDraft] = useState<string>('');
    const [writes, setWrites] = useState(0);
    return (
      <div>
        <ControlPanel
          schema={schema}
          config={config}
          setConfig={(path, value) => {
            setWrites((n) => n + 1);
            setConfig((prev) => withValueAtPath(prev, path, value));
          }}
          draftConfig={(path, value) => setDraft(`${path} = ${JSON.stringify(value)}`)}
        />
        <p>
          writes: {writes} · last draft: {draft || '—'}
        </p>
      </div>
    );
  },
};

/** `errors` puts a message under the row it names; `changed` marks the rows
 *  that differ from a baseline. Clearing Seed leaves it unset. */
export const ErrorsAndChanges: Story = {
  render: () => {
    const [config, setConfig] = useState<Config>(baseline);
    const speed = config.speed as number;
    const changed = new Set(Object.keys(baseline).filter((k) => config[k] !== baseline[k]));
    return (
      <ControlPanel
        schema={schema}
        config={config}
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
        changed={changed}
        errors={speed > 8 ? { speed: 'Above 8 the simulation drops frames.' } : {}}
      />
    );
  },
};
