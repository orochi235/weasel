import type { Meta, StoryObj } from '@weasel-js/forge';
import { StatRow } from '@weasel-js/ui/components/StatRow';

const meta: Meta<typeof StatRow> = {
  title: 'ui/StatRow',
  component: StatRow,
  args: {
    'aria-label': 'At a glance',
    stats: [
      { label: 'found', value: '42' },
      { label: 'fixed', value: '30', accent: 'var(--wzl-success)' },
      { label: 'fixing', value: '5', accent: 'var(--wzl-accent)' },
      { label: 'left', value: '7', tone: 'estimate', tip: 'Estimated from how fast new finds are drying up.' },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof StatRow>;

/** Counts with accent bars tying them to a chart's colors, and an estimate set apart by its type, its word carrying a
 *  tooltip. */
export const Counts: Story = {};

/** Spread end to end, with a light figure and a clock whose changing digits never move the figures after it. */
export const Spread: Story = {
  args: {
    justify: 'between',
    stats: [
      { label: 'passes', value: '6' },
      { label: 'spent', value: '$4.20', tone: 'light' },
      { label: 'elapsed', value: '9:41', tone: 'clock' },
      { label: 'next finds', value: '0.4', tone: 'estimate' },
    ],
  },
};
