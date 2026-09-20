import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Jog } from './Jog';

const meta: Meta<typeof Jog> = {
  title: 'weasel-ui/Jog',
  component: Jog,
};
export default meta;

type Story = StoryObj<typeof Jog>;

function Live({ count, unit, scrub }: { count: number; unit?: string; scrub?: boolean }) {
  const [index, setIndex] = useState(2);
  const [playing, setPlaying] = useState(false);
  return (
    <div style={{ width: 460 }}>
      <Jog
        index={index}
        count={count}
        unit={unit}
        playing={playing}
        onPlay={setPlaying}
        onStep={(by) => setIndex((i) => Math.min(count - 1, Math.max(0, i + by)))}
        {...(scrub ? { onScrub: setIndex } : {})}
        caption="the caption sits last, where it cannot shove the row"
      />
    </div>
  );
}

export const Steps: Story = { render: () => <Live count={9} scrub /> };
export const Beats: Story = { render: () => <Live count={24} unit="Beat" scrub /> };
/** A long list is where the readout's padding earns itself: 9 to 10 to 100 never shifts. */
export const Long: Story = { render: () => <Live count={120} scrub /> };
/** No `onScrub`, so the buttons are the whole control. */
export const NoScrubber: Story = { render: () => <Live count={9} /> };
