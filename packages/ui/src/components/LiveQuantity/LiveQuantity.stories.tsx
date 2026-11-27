import type { Meta, StoryObj } from '@weasel-js/forge';
import { bytes, duration, relative } from '@weasel-js/quantity';
import { LiveQuantity } from '@weasel-js/ui/components/LiveQuantity';

const meta: Meta<typeof LiveQuantity> = {
  title: 'ui/LiveQuantity',
  component: LiveQuantity,
};
export default meta;
type Story = StoryObj<typeof LiveQuantity>;

const at = typeof performance === 'undefined' ? 0 : performance.now();
const perSecond = 1 / 1000;

/** An elapsed time measured at 59 minutes 50 seconds, counting on: watch it widen at the hour without moving what follows. */
export const Elapsed: Story = { args: { reading: { value: 3590, at, rate: perSecond }, display: duration() } };

/** A countdown from a minute. */
export const Countdown: Story = { args: { reading: { value: 60, at, rate: -perSecond }, display: duration() } };

/** A download at 2.5 MB a second. */
export const Bytes: Story = { args: { reading: { value: 1_200_000, at, rate: 2500 }, display: bytes() } };

/** Something that happened 58 seconds ago: it turns `1 min. ago` in two seconds, then wakes once a minute. */
export const Ago: Story = { args: { reading: { value: -58, at, rate: -perSecond }, display: relative() } };

/** Paused: drawn once, never woken. */
export const Paused: Story = { args: { reading: { value: 75, at, rate: 0 }, display: duration() } };
