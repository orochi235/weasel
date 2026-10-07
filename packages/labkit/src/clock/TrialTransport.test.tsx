import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { TrialTransport, type TrialTransportProps } from './TrialTransport';
import type { ClockCapability, TrialClock } from './trialClock';

let clock: TrialClock | null = null;

function timed(spec: ClockCapability | undefined, props: TrialTransportProps = {}): Instrument {
  return {
    name: 'Timed',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    ...(spec ? { clock: spec } : {}),
    render: (ctx) => {
      clock = ctx.trial.clock ?? null;
      return (
        <>
          <TrialTransport {...props} />
          <input aria-label="field" />
        </>
      );
    },
  };
}

async function mount(spec: ClockCapability | undefined, props?: TrialTransportProps) {
  return renderSettled(<Lab instruments={[timed(spec, props)]} defaultInstrument="Timed" />);
}

const c = () => clock as TrialClock;
const press = (name: string) => act(() => fireEvent.click(screen.getByRole('button', { name })));
const key = (k: string, target: Element = document.body) =>
  act(() => fireEvent.keyDown(target, { key: k }));

afterEach(() => {
  clock = null;
  vi.useRealTimers();
});

describe('<TrialTransport>', () => {
  it('renders nothing for a trial without a clock', async () => {
    await mount(undefined);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('plays at the chosen speed and pauses', async () => {
    await mount({ duration: 1000 });
    fireEvent.keyDown(screen.getByRole('slider', { name: /rate/i }), { key: 'ArrowRight' });
    expect(c().rate).toBe(0);
    press('Play');
    expect(c().rate).toBe(2);
    press('Pause');
    expect(c().rate).toBe(0);
  });

  it('reverses and scrubs a seekable clock', async () => {
    await mount({ duration: 1000, rate: 1 });
    act(() => {
      fireEvent.click(screen.getByRole('switch', { name: 'Reverse' }));
    });
    expect(c().rate).toBe(-1);
    act(() => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Position' }), { key: 'End' });
    });
    expect(c().elapsed).toBe(1000);
  });

  it('offers neither on a clock that only runs forward', async () => {
    await mount({ duration: 1000, seekable: false });
    expect(screen.queryByRole('switch', { name: 'Reverse' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Position' })).toBeNull();
  });

  it('shows the playhead within the current pass of a looping clock', async () => {
    await mount({ duration: 1000, loop: true });
    act(() => c().seek(2300));
    expect(screen.getByRole('slider', { name: 'Position' })).toHaveAttribute(
      'aria-valuenow',
      '300',
    );
    act(() => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Position' }), { key: 'Home' });
    });
    expect(c().elapsed).toBe(2000);
  });

  it('plays a finished run again from the start', async () => {
    await mount({ duration: 1000 });
    act(() => c().seek(1000));
    press('Play');
    expect(c().elapsed).toBe(0);
    expect(c().rate).toBe(1);
  });

  it('replays a finished run after its hold, until the transport is touched', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await mount({ duration: 1000 }, { replay: 3000 });
    act(() => c().seek(1000));
    act(() => vi.advanceTimersByTime(2999));
    expect(c().elapsed).toBe(1000);
    act(() => vi.advanceTimersByTime(1));
    expect(c().elapsed).toBe(0);
    expect(c().rate).toBe(1);

    press('Pause');
    act(() => c().seek(1000));
    act(() => vi.advanceTimersByTime(5000));
    expect(c().elapsed).toBe(1000);
  });

  describe('with keys', () => {
    it('answers Space, the arrows, Home and End, R, and < and >', async () => {
      await mount({ duration: 1000 }, { keys: true });
      key(' ');
      expect(c().rate).toBe(1);
      key('>');
      expect(c().rate).toBe(2);
      key('<');
      key('<');
      expect(c().rate).toBe(0.5);
      key('r');
      expect(c().rate).toBe(-0.5);
      key(' ');
      expect(c().rate).toBe(0);
      key('End');
      expect(c().elapsed).toBe(1000);
      key('ArrowLeft');
      expect(c().elapsed).toBe(950);
      key('Home');
      key('ArrowRight');
      expect(c().elapsed).toBe(50);
    });

    it('leaves a key typed into a field, or pressed on a control, alone', async () => {
      await mount({ duration: 1000 }, { keys: true });
      key(' ', screen.getByRole('textbox', { name: 'field' }));
      key(' ', screen.getByRole('button', { name: 'Play' }));
      expect(c().rate).toBe(0);
    });

    it('answers none without `keys`', async () => {
      await mount({ duration: 1000 });
      key(' ');
      expect(c().rate).toBe(0);
    });
  });
});
