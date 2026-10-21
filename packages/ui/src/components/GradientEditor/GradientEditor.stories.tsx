import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { Paint, GradientPaint } from '@weasel-js/core';
import { seedMeshPatch } from '@weasel-js/core/mesh';
import { GradientEditor } from '@weasel-js/ui/components/GradientEditor';

const meta: Meta<typeof GradientEditor> = {
  title: 'ui/GradientEditor',
  component: GradientEditor,
  args: { kindSwitch: true, spaceSwitch: true, svg: false, disabled: false },
  argTypes: {
    kindSwitch: { control: 'boolean' },
    svg: { control: 'boolean' },
    spaceSwitch: { control: 'boolean' },
    disabled: { control: 'boolean' },
    selectedStop: { table: { disable: true } },
    onSelectedStopChange: { table: { disable: true } },
    value: { table: { disable: true } },
    onInput: { table: { disable: true } },
    onChange: { table: { disable: true } },
    className: { table: { disable: true } },
  } as never,
};
export default meta;

type Story = StoryObj<typeof GradientEditor>;

type LiveArgs = Omit<Parameters<typeof GradientEditor>[0], 'value' | 'onChange' | 'onInput' | 'selectedStop' | 'onSelectedStopChange'>;

/** Holds the value, and the selection too, so a story can open on a stop other than the first. */
function Live({ initial, startOn, ...args }: LiveArgs & { initial: Paint; startOn?: number }) {
  const [value, setValue] = useState(initial);
  const [selected, setSelected] = useState(startOn);
  return (
    <GradientEditor
      {...args}
      value={value}
      selectedStop={selected}
      onSelectedStopChange={setSelected}
      onInput={setValue}
      onChange={setValue}
    />
  );
}

const linear = (stops: GradientPaint['stops']): GradientPaint =>
  ({ kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops }) as GradientPaint;

/** The smallest gradient. The first stop is selected, and the row under the
 *  track edits it; neither stop can be removed, so the remove button is off. */
export const TwoStops: Story = {
  render: (args) => (
    <Live
      {...args}
      initial={linear([
        { offset: 0, color: '#ff0000ff' },
        { offset: 1, color: '#0000ffff' },
      ])}
    />
  ),
};

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

const SPECTRUM = ['#ff3b30ff', '#ff9500ff', '#ffcc00ff', '#34c759ff', '#00c7beff', '#007affff', '#5856d6ff', '#af52deff', '#ff2d55ff'];

/** The editor is the same height at nine stops as at two: there is one row for
 *  whichever stop is selected, not one per stop. */
export const ManyStops: Story = {
  render: (args) => (
    <Live
      {...args}
      initial={linear(SPECTRUM.map((color, i) => ({ offset: i / (SPECTRUM.length - 1), color })))}
    />
  ),
};

/** The selected stop is the middle one, at 35% opacity. Its handle and the
 *  ramp around it show the checker through the color. */
export const TranslucentStop: Story = {
  render: (args) => (
    <Live
      {...args}
      startOn={1}
      initial={linear([
        { offset: 0, color: '#0a84ffff' },
        { offset: 0.5, color: '#ff375f59' },
        { offset: 1, color: '#ffd60a00' },
      ])}
    />
  ),
};

/** Dimmed, out of the tab order, and taking no input. */
export const Disabled: Story = {
  args: { disabled: true },
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
  render: (args) => <Live {...args} initial={seedMeshPatch('#3a7bd5ff') as unknown as Paint} />,
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
        kind: 'conic-gradient',
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
