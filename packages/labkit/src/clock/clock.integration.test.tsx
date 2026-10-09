import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { useLabContext } from '../lab/LabContext';
import { useLabStore } from '../state/context';
import { useTrialClock } from './hooks';

function Readout({ label }: { label: string }) {
  const clock = useTrialClock();
  return <output aria-label={label}>{clock ? `${clock.elapsed}@${clock.rate}` : 'none'}</output>;
}

function Persisted({ trialId }: { trialId: string }) {
  const clock = useLabStore().trials.find((t) => t.id === trialId)?.clock;
  return (
    <output aria-label="persisted">{clock ? `${clock.elapsed}@${clock.rate}` : 'none'}</output>
  );
}

function ResetButton({ trialId }: { trialId: string }) {
  const lab = useLabContext();
  return (
    <button type="button" onClick={() => lab.resetTrial(trialId)}>
      reset trial
    </button>
  );
}

const timed: Instrument = {
  name: 'Timed',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  clock: { duration: 1000 },
  render: (ctx) => (
    <>
      <button type="button" onClick={() => ctx.trial.clock?.seek(500)}>
        seek
      </button>
      <button
        type="button"
        onClick={() => {
          if (ctx.trial.clock) ctx.trial.clock.rate = 2;
        }}
      >
        fast
      </button>
      <Readout label="inside" />
      <Persisted trialId={ctx.trial.id} />
      <ResetButton trialId={ctx.trial.id} />
    </>
  ),
};

describe('a trial clock in a mounted lab', () => {
  it('reaches the instrument, the trial, the lab, the record and Reset', async () => {
    await renderSettled(
      <Lab title="T" instruments={[timed]} defaultInstrument="Timed">
        <Readout label="outside" />
      </Lab>,
    );
    expect(screen.getByLabelText('inside')).toHaveTextContent('0@0');
    expect(screen.getByLabelText('outside')).toHaveTextContent('0@0');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'seek' }));
    });
    expect(screen.getByLabelText('inside')).toHaveTextContent('500@0');
    expect(screen.getByLabelText('outside')).toHaveTextContent('500@0');
    expect(screen.getByLabelText('persisted')).toHaveTextContent('500@0');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'fast' }));
    });
    expect(screen.getByLabelText('persisted')).toHaveTextContent('500@2');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reset trial' }));
    });
    expect(screen.getByLabelText('inside')).toHaveTextContent('0@0');
    expect(screen.getByLabelText('persisted')).toHaveTextContent('0@0');
  });

  it('gives an instrument without a clock none', async () => {
    const plain: Instrument = {
      ...timed,
      name: 'Plain',
      clock: undefined,
      render: () => <Readout label="inside" />,
    };
    await renderSettled(<Lab title="T" instruments={[plain]} defaultInstrument="Plain" />);
    expect(screen.getByLabelText('inside')).toHaveTextContent('none');
  });

  it("puts every trial declaring 'lab' on the lab's one clock", async () => {
    const shared: Instrument = {
      ...timed,
      name: 'Shared',
      clock: 'lab',
      render: (ctx) => (
        <>
          <button type="button" onClick={() => ctx.trial.clock?.seek(300)}>
            seek {ctx.trial.id}
          </button>
          <Readout label={`in ${ctx.trial.id}`} />
          <ResetButton trialId={ctx.trial.id} />
        </>
      ),
    };
    await renderSettled(
      <Lab
        title="T"
        instruments={[shared]}
        defaultInstrument="Shared"
        opening={['Shared', 'Shared']}
        clock={{ duration: 1000 }}
      >
        <Readout label="outside" />
      </Lab>,
    );
    const seeks = screen.getAllByRole('button', { name: /^seek/ });
    expect(seeks).toHaveLength(2);
    await act(async () => {
      fireEvent.click(seeks[0] as HTMLElement);
    });
    for (const readout of screen.getAllByLabelText(/^in /))
      expect(readout).toHaveTextContent('300@0');
    expect(screen.getByLabelText('outside')).toHaveTextContent('300@0');

    // One trial's Reset is not every trial's.
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'reset trial' })[0] as HTMLElement);
    });
    expect(screen.getByLabelText('outside')).toHaveTextContent('300@0');
  });

  it("refuses 'lab' in a lab that declares no clock", async () => {
    const shared: Instrument = { ...timed, name: 'Shared', clock: 'lab' };
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      renderSettled(<Lab title="T" instruments={[shared]} defaultInstrument="Shared" />),
    ).rejects.toThrow(/declares no `clock`/);
    quiet.mockRestore();
  });

  it('sets the document title while mounted', async () => {
    const before = document.title;
    const { unmount } = await renderSettled(
      <Lab title="T" documentTitle="rosee" instruments={[timed]} defaultInstrument="Timed" />,
    );
    expect(document.title).toBe('rosee');
    unmount();
    expect(document.title).toBe(before);
  });
});
