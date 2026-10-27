import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { type LabContextValue, useLabContext } from '../lab/LabContext';
import { useTrialClock } from './hooks';

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
  clock: { duration: 3000 },
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

const shown = () => screen.getByRole('status', { name: 'clock' }).textContent;

describe('a trial clock in a snapshot', () => {
  it('comes back where it stood when the snapshot is loaded', async () => {
    await renderSettled(<Lab instruments={[timed]} defaultInstrument="Timed" />, { wrapper: withIcons });
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
});
