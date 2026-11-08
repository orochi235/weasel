import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ClockFrames, HeldClock } from './HeldClock';
import { useClockFrame, useTrialClock } from './hooks';

function Readout() {
  const clock = useTrialClock();
  return <output aria-label="elapsed">{clock ? String(clock.elapsed) : 'none'}</output>;
}

function Drawn() {
  const [drawn, setDrawn] = useState('not drawn');
  useClockFrame((elapsed) => setDrawn(String(elapsed)));
  return <output aria-label="drawn">{drawn}</output>;
}

describe('HeldClock', () => {
  it('stands a clock of its own at `at`, paused, for what reads the trial clock', () => {
    render(
      <HeldClock spec={{ duration: 1000, rate: 1 }} at={300}>
        <Readout />
      </HeldClock>,
    );
    expect(screen.getByLabelText('elapsed')).toHaveTextContent('300');
  });

  it('syncs once, so a frame listener draws the held moment with no frame loop', () => {
    render(
      <HeldClock spec={{ duration: 1000 }} at={250}>
        <Drawn />
      </HeldClock>,
    );
    expect(screen.getByLabelText('drawn')).toHaveTextContent('250');
  });

  it('runs a clock that is not seekable there from its start, `step` ms a frame', () => {
    render(
      <HeldClock spec={{ duration: 1000, seekable: false, step: 100 }} at={300}>
        <Readout />
      </HeldClock>,
    );
    expect(screen.getByLabelText('elapsed')).toHaveTextContent('300');
  });

  it('warns, and stays at the start, for a clock it can neither seek nor run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <HeldClock spec={{ duration: 1000, seekable: false }} at={300}>
        <Readout />
      </HeldClock>,
    );
    expect(screen.getByLabelText('elapsed')).toHaveTextContent('0');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not seekable'));
    warn.mockRestore();
  });
});

describe('ClockFrames', () => {
  it('shows each frame of a looping pass under a clock held at its time', () => {
    render(
      <ClockFrames label="Spin" spec={{ duration: 400, loop: true }} every={100}>
        <Readout />
      </ClockFrames>,
    );
    expect(screen.getAllByLabelText('elapsed').map((o) => o.textContent)).toEqual([
      '0',
      '100',
      '200',
      '300',
    ]);
    expect(screen.getAllByRole('figure').at(2)?.querySelector('figcaption')).toHaveTextContent(
      '200 ms',
    );
  });
});
