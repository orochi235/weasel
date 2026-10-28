import { act, fireEvent, screen } from '@testing-library/react';
import type { ClockHandle, ClockRegistry } from '@weasel-js/clock';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { StrictMode, useContext } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { type LabContextValue, useLabContext } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import { ClockRegistryContext } from './contexts';
import { useTrialClock, useTrialClockHandle } from './hooks';
import { TrialTransport } from './TrialTransport';
import type { ClockCapability } from './trialClock';

let lab: LabContextValue | null = null;
let store: LabStore | null = null;
let registry: ClockRegistry | null = null;
let handle: ClockHandle | null = null;
const rootOfClock = () => (handle ? registry?.targets(handle)[0]?.() : undefined);

function Probe() {
  lab = useLabContext();
  store = useContext(LabStoreContext)?.store ?? null;
  registry = useContext(ClockRegistryContext);
  handle = useTrialClockHandle();
  return null;
}

function Readout() {
  const clock = useTrialClock();
  return (
    <output aria-label="clock">{clock ? `${clock.elapsed}/${clock.duration}` : 'none'}</output>
  );
}

type Declare = (seconds: number) => ClockCapability | null;

const make = (clock: Declare) =>
  defineInstrument({
    name: 'Config clock',
    config: f.schema({ seconds: f.number(2).range(0, 10).step(1) }),
    initialState: () => ({}),
    clock: (c) => clock(c.seconds),
    render: (ctx) => (
      <>
        <Readout />
        <TrialTransport />
        <Probe />
        <button type="button" onClick={() => ctx.trial.clock?.seek(1500)}>
          seek
        </button>
        <button type="button" onClick={() => ctx.setConfig('seconds', 4)}>
          four
        </button>
        <button type="button" onClick={() => ctx.setConfig('seconds', 0)}>
          zero
        </button>
        <button type="button" onClick={() => ctx.setConfig('seconds', 3)}>
          three
        </button>
      </>
    ),
  });

const mount = (clock: Declare) =>
  renderSettled(<Lab title="T" instruments={[make(clock)]} defaultInstrument="Config clock" />, {
    wrapper: withIcons,
  });
const click = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
const readout = () => screen.getByLabelText('clock');

describe('a clock declared from config', () => {
  it('keeps its place and takes the new duration when config changes', async () => {
    await mount((s) => ({ duration: s * 1000 }));
    expect(readout()).toHaveTextContent('0/2000');
    await click('seek');
    await click('four');
    expect(readout()).toHaveTextContent('1500/4000');
  });

  it('does not redeclare for a fresh object with the same fields', async () => {
    await mount((s) => ({ duration: s * 1000 }));
    await click('seek');
    await click('three');
    await click('three');
    expect(readout()).toHaveTextContent('1500/3000');
  });

  it('drops the clock on null and opens a fresh one at the start on return', async () => {
    await mount((s) => (s > 0 ? { duration: s * 1000 } : null));
    await click('seek');
    expect(readout()).toHaveTextContent('1500/2000');
    await click('zero');
    expect(readout()).toHaveTextContent('none');
    await click('four');
    expect(readout()).toHaveTextContent('0/4000');
  });
});

describe('a clock declared from config, in a snapshot', () => {
  it('opens at the snapshot position when loading the snapshot turns it back on', async () => {
    await mount((s) => (s > 0 ? { duration: s * 1000 } : null));
    await click('seek');
    const trialId = lab?.trials[0]?.id as string;
    await act(async () => lab?.saveSnapshot(trialId, 'on'));
    await click('zero');
    expect(readout()).toHaveTextContent('none');
    await act(async () => lab?.loadSnapshot(trialId, lab.savedSnapshots[0]?.id as string));
    expect(readout()).toHaveTextContent('1500/2000');
  });
});

describe('a clock declared from config, in the trial', () => {
  it('shows a transport only while it has a clock', async () => {
    await mount((s) => (s > 0 ? { duration: s * 1000 } : null));
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeNull();
    await click('zero');
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    await click('three');
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeNull();
  });

  it('registers the trial root as the element showing it', async () => {
    await mount((s) => ({ duration: s * 1000 }));
    expect(rootOfClock()).toBeInstanceOf(HTMLElement);
    expect((rootOfClock() as HTMLElement).classList.contains('lk-trial')).toBe(true);
  });

  it('holds a reopened time past its first run in its own pass until the run grows', async () => {
    await mount((s) => ({ duration: 1000, loop: s }));
    const first = lab?.trials[0]?.id as string;
    await act(async () => {
      store?.getState().updateTrialClock(first, { elapsed: 2500, rate: 0 });
      lab?.cloneTrial(first);
    });
    await act(async () => {
      lab?.closeTrial(first);
    });
    expect(readout()).toHaveTextContent('2000/1000');
    await click('three');
    expect(readout()).toHaveTextContent('2500/1000');
  });

  it('holds a reopened time its first span cannot reach until the span grows', async () => {
    await mount((s) => ({ duration: s * 1000 }));
    const first = lab?.trials[0]?.id as string;
    await act(async () => {
      store?.getState().updateTrialClock(first, { elapsed: 3000, rate: 0 });
      lab?.cloneTrial(first);
    });
    await act(async () => {
      lab?.closeTrial(first);
    });
    expect(readout()).toHaveTextContent('2000/2000');
    await click('four');
    expect(readout()).toHaveTextContent('3000/4000');
  });
});

describe('a clock declared from config, under StrictMode', () => {
  it('makes one clock, and calls its mix factory once', async () => {
    const mix = vi.fn(() => ({ sync() {}, seek() {}, now: 0 }));
    await renderSettled(
      <StrictMode>
        <Lab
          title="T"
          instruments={[make((s) => ({ duration: s * 1000, mix }))]}
          defaultInstrument="Config clock"
        />
      </StrictMode>,
      { wrapper: withIcons },
    );
    expect(readout()).toHaveTextContent('0/2000');
    expect(mix).toHaveBeenCalledTimes(1);
  });
});
