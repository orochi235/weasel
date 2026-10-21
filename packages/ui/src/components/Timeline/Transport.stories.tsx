import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Transport, type TransportProps } from '@weasel-js/ui/components/Timeline';

const meta: Meta<typeof Transport> = {
  title: 'ui/Transport',
  component: Transport,
};
export default meta;

type Story = StoryObj<typeof Transport>;

/** Every control wired to state, with nothing playing it: the scrub bar and
 *  reverse switch appear because their handlers are given. */
function Harness(
  { args, scrub = true, reverse = true }: { args: TransportProps; scrub?: boolean; reverse?: boolean },
): ReactElement {
  const [paused, setPaused] = useState(args.paused);
  const [loop, setLoop] = useState(args.loop);
  const [rate, setRate] = useState(args.rate);
  const [backward, setBackward] = useState(args.reverse ?? false);
  const [playhead, setPlayhead] = useState(args.playhead);
  return (
    <div style={{ width: 640 }}>
      <Transport
        {...args}
        paused={paused}
        loop={loop}
        rate={rate}
        playhead={playhead}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onLoopChange={setLoop}
        onRateChange={setRate}
        {...(scrub ? { onSeek: setPlayhead } : {})}
        {...(reverse ? { reverse: backward, onReverseChange: setBackward } : {})}
      />
    </div>
  );
}

export const Full: Story = {
  args: { paused: true, loop: true, rate: 1, playhead: 4200, duration: 12000, reverse: false },
  render: (args) => <Harness args={args} />,
};
export const PlayOnly: Story = {
  args: { paused: true, loop: true, rate: 1, playhead: 4200, duration: 12000 },
  render: (args) => <Harness args={args} scrub={false} reverse={false} />,
};
