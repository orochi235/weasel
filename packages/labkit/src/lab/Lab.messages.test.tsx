import { act, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, describe, expect, type MockInstance, vi } from 'vitest';
import type { ClockCapability, TrialClock } from '../clock/trialClock';
import type { Instrument } from '../instrument/types';
import { it as liveTest } from '../testing/liveTest';
import { Lab } from './Lab';
import type { LabProps } from './labProps';
import type { PresentationState } from './presentationMessages';

let clock: TrialClock | null = null;

function timed(spec: ClockCapability | undefined): Instrument {
  return {
    name: 'Timed',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    ...(spec ? { clock: spec } : {}),
    render: (ctx) => {
      clock = ctx.trial.clock ?? null;
      return <div data-testid="content" />;
    },
  };
}

function mountLab(spec: ClockCapability | undefined, props: Partial<LabProps> = {}) {
  return renderSettled(
    <Lab
      {...({
        instruments: [timed(spec)],
        defaultInstrument: 'Timed',
        present: true,
        ...props,
      } as LabProps)}
    />,
    { wrapper: withIcons },
  );
}

const c = () => clock as TrialClock;

// A clock stops at the end of its span, so a test asserting it still plays needs a span
// no stall of a loaded worker can reach.
const SPAN = 3_600_000;

// jsdom's own `postMessage` delivers an event with no `source`, which a browser
// never does, so the host's message is dispatched as the browser would shape it.
const send = (data: unknown, init: MessageEventInit = {}) =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', { data, source: window, origin: location.origin, ...init }),
    );
  });

const it = liveTest.extend<{ host: { mount: typeof mountLab; send: typeof send } }>({
  host: async ({ live }, provide) => provide({ mount: live(mountLab), send: live(send) }),
});

let posted: MockInstance<typeof window.postMessage>;
const states = (): PresentationState[] =>
  posted.mock.calls
    .map(([data]) => data as PresentationState)
    .filter((data) => data?.type === 'labkit:state');
const lastState = () => states().at(-1);

beforeEach(() => {
  posted = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
});

afterEach(() => {
  clock = null;
  vi.restoreAllMocks();
});

describe('a presented lab’s messages', () => {
  it('plays and pauses on the host’s word', async ({ host }) => {
    await host.mount({ duration: SPAN });
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(1);
    await host.send({ type: 'labkit:pause' });
    expect(c().rate).toBe(0);
  });

  it('plays at the speed the transport holds, and moves its button', async ({ host }) => {
    await host.mount({ duration: SPAN, rate: 2 });
    await host.send({ type: 'labkit:pause' });
    expect(screen.getByRole('button', { name: 'Play' })).not.toBeNull();
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(2);
    expect(screen.getByRole('button', { name: 'Pause' })).not.toBeNull();
  });

  it('plays with the controls left off', async ({ host }) => {
    await host.mount({ duration: SPAN }, { transport: false });
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(1);
  });

  it('starts an ended run over on play', async ({ host }) => {
    // On a real clock a slow mount outlasts the replay hold, and the replay has moved
    // the run on from 0 by the time play arrives.
    vi.useFakeTimers();
    try {
      await host.mount({ duration: 4000, start: 'end' });
      await host.send({ type: 'labkit:play' });
      expect(c().elapsed).toBe(0);
      expect(c().rate).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('seeks within the pass', async ({ host }) => {
    await host.mount({ duration: 4000 });
    await host.send({ type: 'labkit:seek', time: 1500 });
    expect(c().elapsed).toBe(1500);
  });

  it('stops the replay of an ended run once the host has spoken', async ({ host }) => {
    vi.useFakeTimers();
    try {
      await host.mount({ duration: 4000, start: 'end' });
      await host.send({ type: 'labkit:pause' });
      await act(async () => vi.advanceTimersByTime(5000));
      expect(c().elapsed).toBe(4000);
      expect(c().rate).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports its state as it starts, on a change, and when asked', async ({ host }) => {
    await host.mount({ duration: SPAN });
    // Not first `clock: false` from before the trial's clock is in.
    expect(states()).toHaveLength(1);
    expect(lastState()).toEqual({
      type: 'labkit:state',
      clock: true,
      playing: false,
      ended: false,
      time: 0,
      duration: SPAN,
      rate: 1,
      seekable: true,
    });
    expect(posted.mock.calls.at(-1)?.[1]).toBe('*');

    await host.send({ type: 'labkit:play' });
    expect(lastState()?.playing).toBe(true);

    const before = states().length;
    await host.send({ type: 'labkit:query' });
    expect(states()).toHaveLength(before + 1);
  });

  it('reports a trial without a clock as having none', async ({ host }) => {
    await host.mount(undefined);
    expect(lastState()).toMatchObject({ clock: false, playing: false, duration: null });
    await host.send({ type: 'labkit:play' });
  });

  it('answers a trial whose function clock resolves to none', async ({ host }) => {
    const none: Instrument = { ...timed(undefined), clock: () => null };
    await renderSettled(
      <Lab {...({ instruments: [none], defaultInstrument: 'Timed', present: true } as LabProps)} />,
      { wrapper: withIcons },
    );
    expect(lastState()).toMatchObject({ clock: false, duration: null });
    const before = states().length;
    await host.send({ type: 'labkit:query' });
    expect(states()).toHaveLength(before + 1);
  });

  it('answers only its host: the window around it, or its own', async ({ host }) => {
    await host.mount({ duration: 4000 });
    await host.send({ type: 'labkit:play' }, { source: null });
    expect(c().rate).toBe(0);
  });

  it('takes only the origins it is given', async ({ host }) => {
    await host.mount({ duration: SPAN }, { messages: { origins: ['https://host.example'] } });
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(0);
    await host.send({ type: 'labkit:play' }, { origin: 'https://host.example' });
    expect(c().rate).toBe(1);
  });

  it('takes a message addressed to another lab as not its own', async ({ host }) => {
    await host.mount({ duration: SPAN }, { messages: { name: 'hero' } });
    await host.send({ type: 'labkit:play', lab: 'other' });
    expect(c().rate).toBe(0);
    await host.send({ type: 'labkit:play', lab: 'hero' });
    expect(c().rate).toBe(1);
    expect(lastState()?.lab).toBe('hero');
  });

  it('ignores what is not a message of its own', async ({ host }) => {
    await host.mount({ duration: 4000 });
    await host.send('labkit:play');
    await host.send(null);
    await host.send({ type: 'play' });
    await host.send({ type: 'labkit:seek', time: 'soon' });
    expect(c().rate).toBe(0);
    expect(c().elapsed).toBe(0);
  });

  it('is off with `messages={false}`, in a still, and outside a presentation', async ({ host }) => {
    const off = await host.mount({ duration: 4000 }, { messages: false });
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(0);
    off.unmount();

    const still = await host.mount({ duration: 4000 }, { still: true });
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(0);
    still.unmount();

    posted.mockClear();
    await host.mount({ duration: 4000 }, { present: false });
    await host.send({ type: 'labkit:play' });
    expect(c().rate).toBe(0);
    expect(states()).toHaveLength(0);
  });
});
