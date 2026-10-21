import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { f, withValueAtPath, resolveConfigSchema } from '@weasel-js/labkit/config';
import { ControlPanel } from '@weasel-js/labkit/controls';

const meta: Meta<typeof ControlPanel> = {
  title: 'labkit/Controls/ControlPanel/Heading control',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlPanel>;

const headed = f.schema({
  shadow: f
    .group({
      on: f.boolean(true).label('Shadow on').heading(),
      blur: f.number(4).range(0, 40).slider().label('Blur').enableIf({ path: 'shadow.on' }),
      offset: f.number(2).range(0, 20).slider().label('Offset').enableIf({ path: 'shadow.on' }),
    })
    .label('Shadow'),
  join: f.enum('round', ['round', 'miter', 'bevel']).label('Join').section('Edge').heading(),
  width: f.number(1).range(0, 12).slider().label('Width').section('Edge'),
});

/** A leaf marked `.heading()` is drawn in the heading of the group or section holding it, and has no row beneath. */
export const HeadingControl: Story = {
  render: (args) => {
    const schema = resolveConfigSchema(headed, []);
    const [config, setConfig] = useState<Record<string, unknown>>(headed.defaults());
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
