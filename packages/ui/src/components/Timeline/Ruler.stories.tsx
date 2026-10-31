import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Ruler, type TimeWindow } from '@weasel-js/ui/components/Timeline';
import s from './Ruler.stories.module.css';

const meta: Meta<typeof Ruler> = {
  title: 'ui/Ruler',
  component: Ruler,
};
export default meta;

type Story = StoryObj<typeof Ruler>;

const BOUNDS: TimeWindow = { from: 0, to: 12000 };

function Live({ initial }: { initial: TimeWindow }) {
  const [win, setWin] = useState(initial);
  const [playhead, setPlayhead] = useState(4200);
  return (
    <div className={s.track}>
      <Ruler window={win} bounds={BOUNDS} playhead={playhead} onScrub={setPlayhead} onWindowChange={setWin} />
    </div>
  );
}

/** The whole span. Press or drag to scrub; the wheel pans and Ctrl+wheel zooms, within the bounds. */
export const Default: Story = {
  render: () => <Live initial={BOUNDS} />,
};

/** Zoomed in to under a second, where the tick labels carry the decimals that tell them apart. */
export const Zoomed: Story = {
  render: () => <Live initial={{ from: 4000, to: 4800 }} />,
};
