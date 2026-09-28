import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { FillStyle, GradientFill } from '@weasel-js/core';
import { seedMeshPatch } from '@weasel-js/core/mesh';
import { GradientEditor } from './GradientEditor';

const meta: Meta<typeof GradientEditor> = {
  title: 'ui/GradientEditor',
  component: GradientEditor,
  args: { kindSwitch: true, spaceSwitch: true, svg: false },
  argTypes: {
    kindSwitch: { control: 'boolean' },
    svg: { control: 'boolean' },
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

function Live({ initial, ...args }: LiveArgs & { initial: FillStyle }) {
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

/** Every registered gradient kind is on the bar, mesh included. Switching
 *  carries the colors: a stop list becomes one mesh band per gap, and a mesh
 *  reads back as the ramp across its top edge. */
export const Mesh: Story = {
  render: (args) => <Live {...args} initial={seedMeshPatch('#3a7bd5ff') as unknown as FillStyle} />,
};

/** `svg` keeps to what an SVG file carries natively: linear and radial,
 *  blended in sRGB. This gradient is a conic in OKLCh, so both stay on offer
 *  beside the SVG choices until it is switched off them. */
export const Svg: Story = {
  args: { svg: true },
  render: (args) => (
    <Live
      {...args}
      initial={{
        fill: 'conic-gradient',
        center: { x: 0.5, y: 0.5 },
        angle: 0,
        units: 'bounds',
        interpolate: 'oklch',
        stops: [
          { offset: 0, color: '#ff0000ff' },
          { offset: 1, color: '#0000ffff' },
        ],
      }}
    />
  ),
};
