import { act, renderHook } from '@testing-library/react';
import { type Clock, createClock } from '@weasel-js/clock';
import { type Instrument, Lab } from '@weasel-js/labkit';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { installResizeObserver } from '../shell/labHarness';
import { clockSpecOf } from './clockSpec';
import { ClockContext, useTimeline } from './context';
import { shownTime } from './shown';
import type { TimelineSpec } from './types';

const ran = (spec: TimelineSpec, ms: number) => {
  const { clock } = createClock(clockSpecOf(spec));
  clock.rate = 1;
  clock.sync(0);
  clock.sync(ms);
  return clock;
};

const timeline = (spec: TimelineSpec) => {
  const handle = createClock(clockSpecOf(spec));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ClockContext.Provider value={handle}>{children}</ClockContext.Provider>
  );
  return { handle, hook: renderHook(() => useTimeline(), { wrapper }) };
};

describe('a story clock', () => {
  it('loops by default, its playhead wrapping back into the span, and stops paused at the end when told not to', () => {
    expect(shownTime(ran({ start: -200, duration: 1000 }, 1500))).toBe(300);
    const once = ran({ duration: 1000, loop: false }, 1500);
    expect(shownTime(once)).toBe(1000);
    expect(once.rate).toBe(0);
  });

  it('collapses a duration that is not positive and finite to 1 ms, and an empty span pauses where it ends', () => {
    for (const duration of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(clockSpecOf({ duration }).duration).toBe(1);
      const once = ran({ duration, loop: false }, 50);
      expect(once.rate).toBe(0);
      expect(shownTime(once)).toBe(1);
    }
  });

  it('plays at speed 1 for a rate that is not positive and finite, and starts at 0 for a start that is not finite', () => {
    for (const rate of [0, -2, Number.NaN]) expect(clockSpecOf({ duration: 100, rate }).speed).toBe(1);
    expect(clockSpecOf({ duration: 100, start: Number.NaN }).origin).toBe(0);
  });

  it('plays from the end over from the start, clamps a seek, and ignores a rate that is not positive', () => {
    const { hook } = timeline({ start: -300, duration: 1000, loop: false });
    act(() => hook.result.current.seek(5000));
    expect(hook.result.current.time).toBe(700);
    act(() => hook.result.current.seek(-5000));
    expect(hook.result.current.time).toBe(-300);
    act(() => hook.result.current.seek(700));
    act(() => hook.result.current.play());
    expect(hook.result.current).toMatchObject({ playing: true, time: -300 });
    for (const rate of [0, -1, Number.NaN]) act(() => hook.result.current.setRate(rate));
    expect(hook.result.current.rate).toBe(1);
    act(() => hook.result.current.setRate(2));
    expect(hook.result.current.rate).toBe(2);
  });

  it('shows a rate set while paused, and plays at it', () => {
    const { handle, hook } = timeline({ duration: 1000 });
    act(() => hook.result.current.setRate(3));
    expect(hook.result.current).toMatchObject({ playing: false, rate: 3 });
    act(() => hook.result.current.play());
    expect(handle.clock.rate).toBe(3);
  });

  it('keeps the shown time across a span set at runtime, and goes back to the declared span when it is lifted', () => {
    const { hook } = timeline({ duration: 1000 });
    act(() => hook.result.current.seek(600));
    act(() => hook.result.current.setSpan({ start: -500, duration: 4000 }));
    expect(hook.result.current).toMatchObject({ time: 600, span: { start: -500, end: 3500 } });
    act(() => hook.result.current.setSpan(null));
    expect(hook.result.current).toMatchObject({ time: 600, span: { start: 0, end: 1000 } });
  });

  it('keeps a span set at runtime across a redeclare, and takes the redeclared one once the override is lifted', () => {
    const { handle, hook } = timeline({ duration: 1000 });
    act(() => hook.result.current.setSpan({ start: -500, duration: 4000 }));
    act(() => handle.declare(clockSpecOf({ duration: 2000 })));
    expect(hook.result.current.span).toEqual({ start: -500, end: 3500 });
    act(() => hook.result.current.setSpan(null));
    expect(hook.result.current.span).toEqual({ start: 0, end: 2000 });
  });
});

describe('a story clock inside a lab', () => {
  installResizeObserver();

  it("does not re-render on the focused trial's frames when the clock is the story's own", async () => {
    let trialClock: Clock | null = null;
    const timed: Instrument = {
      name: 'Timed',
      defaultConfig: () => ({}),
      initialState: () => ({}),
      clock: { duration: 60_000 },
      render: (ctx) => {
        trialClock = ctx.trial.clock ?? null;
        return null;
      },
    };
    let renders = 0;
    function IndexEntry() {
      useTimeline();
      renders++;
      return null;
    }
    const own = createClock(clockSpecOf({ duration: 1000 }));
    const index = () => (
      <ClockContext.Provider value={own}>
        <IndexEntry />
      </ClockContext.Provider>
    );
    await renderSettled(
      <Lab
        instruments={[timed]}
        defaultInstrument="Timed"
        labChrome={[{ id: 'index', region: 'header', render: index }]}
      />,
      { wrapper: withIcons },
    );
    const clock = trialClock as Clock | null;
    if (!clock) throw new Error('the trial made no clock');
    act(() => {
      clock.rate = 1;
    });
    const before = renders;
    for (let t = 0; t <= 160; t += 16) act(() => clock.sync(t));
    expect(clock.elapsed).toBeGreaterThan(0);
    expect(renders).toBe(before);
  });
});
