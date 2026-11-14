import type { Meta, StoryObj } from '@weasel-js/forge';
import { linearScale, logScale } from '@weasel-js/plot/scales';
import { Ruler, RulerMark, type RulerTick } from '@weasel-js/ui/components/Ruler';
import s from './Ruler.stories.module.css';

const meta: Meta<typeof Ruler> = {
  title: 'ui/Ruler',
  component: Ruler,
};
export default meta;

type Story = StoryObj<typeof Ruler>;

const UNIT = linearScale({ domain: [0, 1], range: [0, 1] });

/** Ticks the ruler places itself, at least 48 px apart, labeled plainly. */
export const Spaced: Story = {
  render: () => <Ruler className={s.strip} scale={linearScale({ domain: [0, 250], range: [0, 1] })} ticks={{ minSpacing: 48 }} />,
};

const TWELFTHS: RulerTick[] = Array.from({ length: 11 }, (_, i) => ({
  at: (i + 1) / 12,
  label: `${i + 1}/12`,
  level: (i + 1) % 3 === 0 ? 0 : 1,
}));

/** Given ticks too close for every label: the ones at a higher `level` give way first, and every notch stays. */
export const Thinned: Story = {
  render: () => <Ruler className={s.strip} scale={UNIT} ticks={TWELFTHS} />,
};

/** Labeled marks at the ends, always shown, with their labels hung inward; tick labels near them give way. */
export const Marks: Story = {
  render: () => (
    <Ruler className={s.strip} scale={UNIT} ticks={TWELFTHS}>
      <RulerMark at={0} label="start" side="start" />
      <RulerMark at={0.4} cursor />
      <RulerMark at={1} label="end" side="end" />
    </Ruler>
  ),
};

/** The `'line'` look, over a log scale whose ticks are given, since spaced ticks are even in value. */
export const LineOnLog: Story = {
  render: () => (
    <Ruler
      className={s.strip}
      look="line"
      scale={logScale({ domain: [1, 1000], range: [0, 1] })}
      ticks={[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map((at) => ({ at, label: String(at) }))}
    />
  ),
};
