import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Jog, type JogProps } from '@weasel-js/ui/components/Jog';
import { Along, type AlongArc } from '@weasel-js/ui/components/Along';
import s from './Jog.stories.module.css';

const meta: Meta<typeof Jog> = {
  title: 'ui/Jog',
  component: Jog,
};
export default meta;

type Story = StoryObj<typeof Jog>;

function useLive(args: JogProps, scrub?: boolean): JogProps {
  const { count } = args;
  const [index, setIndex] = useState(args.index);
  const [playing, setPlaying] = useState(args.playing);
  return {
    ...args,
    index,
    playing,
    onPlay: setPlaying,
    onStep: (by) => setIndex((i) => Math.min(count - 1, Math.max(0, i + by))),
    ...(scrub ? { onScrub: setIndex } : {}),
  };
}

function Live({ args, scrub }: { args: JogProps; scrub?: boolean }) {
  return (
    <div style={{ width: 460 }}>
      <Jog {...useLive(args, scrub)} />
    </div>
  );
}

function Dial({ args, arc, scrub }: { args: JogProps; arc: AlongArc; scrub?: boolean }) {
  return (
    <div className={s.dial}>
      <Along arc={arc}>
        <Jog {...useLive(args, scrub)} />
      </Along>
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
/** Inside an `Along`: the buttons, readout and caption lie along the rim, and the scrubber follows it between them. */
export const AlongTopRim: Story = {
  args: { index: 2, count: 24, playing: false, unit: 'Beat', caption: 'intro' },
  render: (args) => <Dial args={args} arc={{ start: 270, end: 90, inset: 16 }} scrub />,
};
/** Along the bottom rim the run still reads left to right, upright. */
export const AlongBottomRim: Story = {
  args: { index: 2, count: 24, playing: false, unit: 'Beat', caption: 'intro' },
  render: (args) => <Dial args={args} arc={{ start: 90, end: 270, inset: 16 }} scrub />,
};
/** No scrubber: the controls sit where the `Along` aligns them. */
export const AlongNoScrubber: Story = {
  args: { index: 2, count: 9, playing: false },
  render: (args) => <Dial args={args} arc={{ start: 300, end: 60, inset: 16 }} />,
};
