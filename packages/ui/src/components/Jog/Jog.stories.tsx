import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Jog, type JogProps } from '@weasel-js/ui/components/Jog';

const meta: Meta<typeof Jog> = {
  title: 'ui/Jog',
  component: Jog,
};
export default meta;

type Story = StoryObj<typeof Jog>;

function Live({ args, scrub }: { args: JogProps; scrub?: boolean }) {
  const { count } = args;
  const [index, setIndex] = useState(args.index);
  const [playing, setPlaying] = useState(args.playing);
  return (
    <div style={{ width: 460 }}>
      <Jog
        {...args}
        index={index}
        playing={playing}
        onPlay={setPlaying}
        onStep={(by) => setIndex((i) => Math.min(count - 1, Math.max(0, i + by)))}
        {...(scrub ? { onScrub: setIndex } : {})}
      />
    </div>
  );
}

const caption = 'the caption sits last, where it cannot shove the row';

export const Steps: Story = {
  args: { index: 2, count: 9, playing: false, caption },
  render: (args) => <Live args={args} scrub />,
};
export const Beats: Story = {
  args: { index: 2, count: 24, playing: false, unit: 'Beat', caption },
  render: (args) => <Live args={args} scrub />,
};
/** A long list is where the readout's padding earns itself: 9 to 10 to 100 never shifts. */
export const Long: Story = {
  args: { index: 2, count: 120, playing: false, caption },
  render: (args) => <Live args={args} scrub />,
};
/** No `onScrub`, so the buttons are the whole control. */
export const NoScrubber: Story = {
  args: { index: 2, count: 9, playing: false, caption },
  render: (args) => <Live args={args} />,
};
