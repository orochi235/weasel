import type { Meta, StoryObj } from '@weasel-js/forge';
import { f, resolveConfigSchema, withValueAtPath } from '@weasel-js/labkit/config';
import { ControlPanel } from '@weasel-js/labkit/controls';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import { useState } from 'react';

const meta: Meta<typeof ControlPanel> = {
  title: 'labkit/Controls/ControlPanel',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlPanel>;

const envelope = f.schema({
  fade: f
    .group({
      rise: f.number(120).range(0, 1000).label('Rise'),
      fall: f.number(400).range(0, 1000).label('Fall'),
      curve: f.enum('ease', ['linear', 'ease', 'step']).label('Curve'),
      loop: f.boolean(false).label('Loop'),
    })
    .label('Fade')
    .motif(stereo()),
  hold: f
    .group({
      time: f.number(250).range(0, 2000).label('Time'),
      level: f.number(0.8).range(0, 1).label('Level'),
    })
    .label('Hold')
    .motif(stereo({ side: 'right' })),
  gain: f
    .number(1)
    .range(0, 4)
    .label('Gain')
    .section('Output', { motif: stereo({ side: 'top' }) }),
  pan: f.number(0).range(-1, 1).label('Pan').section('Output'),
});

/** `.motif()` on a group, or `motif` on a section, draws it in a `MotifFrame` motif: here `stereo`, a label bar along one edge. */
export const Motifs: Story = {
  render: (args) => {
    const schema = resolveConfigSchema(envelope, []);
    const [config, setConfig] = useState<Record<string, unknown>>(envelope.defaults());
    return (
      <ControlPanel
        {...args}
        schema={schema}
        config={config}
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
      />
    );
  },
};
