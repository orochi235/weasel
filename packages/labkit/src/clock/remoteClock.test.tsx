/**
 * Another tab's write to a trial's record carries that tab's clock position.
 * It must not move this tab's clock, nor start the two tabs trading writes.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { labPrefix } from '../state/labRecords';
import { useTrialClock } from './hooks';

let rate = Number.NaN;

function Readout() {
  const clock = useTrialClock();
  if (clock) rate = clock.rate;
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
      <button type="button" onClick={() => ctx.trial.clock?.seek(1200)}>
        seek
      </button>
      <button
        type="button"
        onClick={() => {
          if (ctx.trial.clock) ctx.trial.clock.rate = 0.001;
        }}
      >
        play
      </button>
    </>
  ),
};

const PREFIX = `${labPrefix('remote-clock')}trial:`;
type Stored = [key: string, record: Record<string, unknown>];

/** A map over storage that counts writes to trial records. */
function countingBacking(): { backing: Map<string, unknown>; writes: () => number } {
  let n = 0;
  const backing = new Map<string, unknown>();
  const set = backing.set.bind(backing);
  backing.set = (key, value) => {
    if (key.startsWith(PREFIX)) n++;
    return set(key, value);
  };
  return { backing, writes: () => n };
}

const shown = () => screen.getByRole('status', { name: 'clock' }).textContent;
const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));

describe("a trial clock whose record another tab's write replaces", () => {
  it('stays where it stands and playing, and writes nothing back', async () => {
    const { backing, writes } = countingBacking();
    await renderSettled(
      <Lab
        instruments={[timed]}
        defaultInstrument="Timed"
        storage={createMemoryAdapter(backing)}
        storageKey="remote-clock"
      />,
      { wrapper: withIcons },
    );
    fireEvent.click(screen.getByRole('button', { name: 'seek' }));
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => {
      const stored = [...backing].find(([key]) => key.startsWith(PREFIX)) as Stored | undefined;
      expect((stored?.[1].clock as { rate?: number } | undefined)?.rate).toBe(0.001);
    });
    const [key, record] = [...backing].find(([k]) => k.startsWith(PREFIX)) as Stored;

    await act(async () => {
      await createMemoryAdapter(backing).set(key, { ...record, clock: { elapsed: 500, rate: 0 } });
      await new Promise((r) => setTimeout(r, 0));
    });
    await settle();
    const after = writes();
    await settle();

    expect(rate).toBe(0.001);
    expect(Number(shown())).toBeGreaterThanOrEqual(1200);
    expect(writes()).toBe(after);
  });
});
