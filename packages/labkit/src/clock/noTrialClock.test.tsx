import { act } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { useClockFrame, useTrialClock, useTrialMix } from './hooks';
import type { TrialClock } from './trialClock';

let trialClock: TrialClock | null = null;
const resolved: unknown[] = [];
const frames = vi.fn();

function NoClock() {
  resolved.push(useTrialClock(null), useTrialMix(null));
  useClockFrame(frames, null);
  return null;
}

const mixed: Instrument = {
  name: 'Mixed',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  clock: { duration: 60_000, mix: () => ({ sync() {}, seek() {}, now: 0 }) },
  render: (ctx) => {
    trialClock = ctx.trial.clock ?? null;
    return <NoClock />;
  },
};

describe('a trialId of null', () => {
  it('resolves no clock, mix or frames inside a trial that has all three', async () => {
    await renderSettled(<Lab instruments={[mixed]} defaultInstrument="Mixed" />, {
      wrapper: withIcons,
    });
    const clock = trialClock as TrialClock | null;
    if (!clock) throw new Error('the trial made no clock');
    act(() => {
      clock.rate = 1;
    });
    for (let t = 0; t <= 64; t += 16) act(() => clock.sync(t));
    expect(clock.elapsed).toBeGreaterThan(0);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.every((r) => r === null)).toBe(true);
    expect(frames).not.toHaveBeenCalled();
  });
});
