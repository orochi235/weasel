import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Transport } from './Transport';

const meta: Meta<typeof Transport> = {
  title: 'ui/Transport',
  component: Transport,
};
export default meta;

/** Every control wired to state, with nothing playing it: the scrub bar and
 *  reverse switch appear because their handlers are given. */
function Harness({ scrub = true, reverse = true }: { scrub?: boolean; reverse?: boolean }): ReactElement {
  const [paused, setPaused] = useState(true);
  const [loop, setLoop] = useState<boolean | number>(true);
  const [rate, setRate] = useState(1);
  const [backward, setBackward] = useState(false);
  const [playhead, setPlayhead] = useState(4200);
  return (
    <div style={{ width: 640 }}>
      <Transport
        paused={paused}
        loop={loop}
        rate={rate}
        playhead={playhead}
        duration={12000}
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

export const Full: StoryObj = { render: () => <Harness /> };
export const PlayOnly: StoryObj = { render: () => <Harness scrub={false} reverse={false} /> };
