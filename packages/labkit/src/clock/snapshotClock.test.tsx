import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { type LabContextValue, useLabContext } from '../lab/LabContext';
import { useTrialClock } from './hooks';

const released = vi.hoisted(() => ({ count: 0 }));

vi.mock('@weasel-js/clock', async (original) => {
  const clock = await original<typeof import('@weasel-js/clock')>();
  return {
    ...clock,
    holdElapsed: (...args: Parameters<typeof clock.holdElapsed>) => {
      const hold = clock.holdElapsed(...args);
      return {
        ...hold,
        release: () => {
          released.count++;
          hold.release();
        },
      };
    },
  };
});

let lab: LabContextValue | null = null;

function Probe() {
  lab = useLabContext();
  return null;
}

function Readout() {
  const clock = useTrialClock();
  return <output aria-label="clock">{clock ? String(clock.elapsed) : 'none'}</output>;
}

const timed: Instrument = {
  name: 'Timed',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  clock: { duration: 3000, start: 700 },
  render: (ctx) => (
    <>
      <Readout />
      <Probe />
      <button type="button" onClick={() => ctx.trial.clock?.seek(1200)}>
        seek
      </button>
      <button type="button" onClick={() => ctx.trial.clock?.seek(0)}>
        home
      </button>
    </>
  ),
};

const looped: Instrument = {
  ...timed,
  name: 'Looped',
  clock: { duration: 1000, loop: 3 },
  render: (ctx) => (
    <>
      <Readout />
      <Probe />
      <button type="button" onClick={() => ctx.trial.clock?.seek(2500)}>
        seek
      </button>
      <button type="button" onClick={() => ctx.trial.clock?.seek(0)}>
        home
      </button>
    </>
  ),
};

const shown = () => screen.getByRole('status', { name: 'clock' }).textContent;

describe('a trial clock in a snapshot', () => {
  it('comes back where it stood when the snapshot is loaded', async () => {
    await renderSettled(<Lab instruments={[timed]} defaultInstrument="Timed" />, {
      wrapper: withIcons,
    });
    fireEvent.click(screen.getByRole('button', { name: 'seek' }));
    expect(shown()).toBe('1200');
    const trialId = lab!.trials[0]!.id;
    act(() => lab!.saveSnapshot(trialId, 'held'));
    fireEvent.click(screen.getByRole('button', { name: 'home' }));
    expect(shown()).toBe('0');
    const saved = lab!.savedSnapshots[0]!;
    act(() => lab!.loadSnapshot(trialId, saved.id));
    expect(shown()).toBe('1200');
  });
  it('comes back where it rested when saved before it ever moved', async () => {
    await renderSettled(<Lab instruments={[timed]} defaultInstrument="Timed" />, {
      wrapper: withIcons,
    });
    expect(shown()).toBe('700');
    const trialId = lab!.trials[0]!.id;
    act(() => lab!.saveSnapshot(trialId, 'rest'));
    fireEvent.click(screen.getByRole('button', { name: 'seek' }));
    expect(shown()).toBe('1200');
    act(() => lab!.loadSnapshot(trialId, lab!.savedSnapshots[0]!.id));
    expect(shown()).toBe('700');
  });
  it('comes back in the pass it stood in, for a clock of several passes', async () => {
    await renderSettled(<Lab instruments={[looped]} defaultInstrument="Looped" />, {
      wrapper: withIcons,
    });
    fireEvent.click(screen.getByRole('button', { name: 'seek' }));
    const trialId = lab!.trials[0]!.id;
    act(() => lab!.saveSnapshot(trialId, 'third pass'));
    fireEvent.click(screen.getByRole('button', { name: 'home' }));
    expect(shown()).toBe('0');
    act(() => lab!.loadSnapshot(trialId, lab!.savedSnapshots[0]!.id));
    expect(shown()).toBe('2500');
  });
  it("lets go of a trial's load hold when the trial closes", async () => {
    await renderSettled(<Lab instruments={[timed]} defaultInstrument="Timed" />, {
      wrapper: withIcons,
    });
    const trialId = lab!.trials[0]!.id;
    act(() => lab!.saveSnapshot(trialId, 'held'));
    act(() => lab!.loadSnapshot(trialId, lab!.savedSnapshots[0]!.id));
    act(() => lab!.addTrial('Timed'));
    const before = released.count;
    act(() => lab!.closeTrial(trialId));
    expect(lab!.trials.map((t) => t.id)).not.toContain(trialId);
    expect(released.count).toBe(before + 1);
  });
});
