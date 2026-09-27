import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { GradientFill } from '@weasel-js/core';
import { GradientEditor } from './GradientEditor';

const meta: Meta<typeof GradientEditor> = {
  title: 'ui/GradientEditor',
  component: GradientEditor,
  args: { kindSwitch: true, spaceSwitch: true },
  argTypes: {
    kindSwitch: { control: 'boolean' },
    spaceSwitch: { control: 'boolean' },
    value: { table: { disable: true } },
    onInput: { table: { disable: true } },
    onChange: { table: { disable: true } },
    className: { table: { disable: true } },
  } as never,
};
export default meta;

type Story = StoryObj<typeof GradientEditor>;

type LiveArgs = Omit<Parameters<typeof GradientEditor>[0], 'value' | 'onChange' | 'onInput'>;

function Live({ initial, ...args }: LiveArgs & { initial: GradientFill }) {
  const [value, setValue] = useState(initial);
  return <GradientEditor {...args} value={value} onInput={setValue} onChange={setValue} />;
}

const linear = (stops: GradientFill['stops']): GradientFill =>
  ({ fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops }) as GradientFill;

/** Stops at 0 and 1 sit flush with the ends of the track, and every stop sits
 *  over its own offset in the painted ramp — the 30% stop over the ramp's 30%
 *  point. */
export const StopsAtTheEnds: Story = {
  render: (args) => (
    <Live
      {...args}
      initial={linear([
        { offset: 0, color: '#ff0000ff' },
        { offset: 0.3, color: '#ffff00ff' },
        { offset: 1, color: '#0000ffff' },
      ])}
    />
  ),
};
