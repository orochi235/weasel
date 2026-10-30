import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { useContext, useEffect } from 'react';
import { afterEach, describe, expect, vi } from 'vitest';
import { loadCsfModule } from '../csf/loadCsfModule';
import { StoryHost } from '../frame/StoryHost';
import { installResizeObserver } from '../shell/labHarness';
import { readRoute } from '../shell/useRoute';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import type { IndexEntry, LoadedStory, StoryContext } from '../story/types';
import { ClockContext, useTimeline } from './context';
import { harness, playhead, playheads, Readout, trial, tParam, workshopIt } from './workshopHarness';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

// These tests drive the timeline; axe auditing every mounted story only costs them time.
vi.mock('../frame/a11y', async (actual) => ({
  ...(await actual<typeof import('../frame/a11y')>()),
  auditElement: () => Promise.resolve({ ok: false, message: 'not audited here' }),
}));

installResizeObserver();

function SpanReadout() {
  const { span } = useTimeline();
  return <output aria-label="span">{`${span.start}..${span.end}`}</output>;
}

/** How long the late story takes to learn its span, standing in for a fixture load; null never learns it. */
let lateDelay: number | null = 20;

/** A story declaring a placeholder span and setting its real one from an effect, once its "fixture" arrives. */
function LateSpan() {
  const { setSpan } = useTimeline();
  useEffect(() => {
    if (lateDelay === null) return;
    const id = setTimeout(() => setSpan({ start: -300, duration: 4000 }), lateDelay);
    return () => clearTimeout(id);
  }, [setSpan]);
  return <Readout />;
}

/** Stands the clock past its first pass, paused, as playing on through a loop leaves it. */
function Lapped() {
  const handle = useContext(ClockContext);
  return (
    <>
      <Readout />
      <button type="button" onClick={() => handle?.clock.seek(9500)}>
        probe: lap
      </button>
    </>
  );
}

const timed: IndexEntry = { id: 't--timed', title: 'T', name: 'Timed', exportName: 'Timed', file: '/t.stories.tsx' };
const still: IndexEntry = { id: 't--still', title: 'T', name: 'Still', exportName: 'Still', file: '/t.stories.tsx' };

const lapped: IndexEntry = { id: 't--lapped', title: 'T', name: 'Lapped', exportName: 'Lapped', file: '/t.stories.tsx' };
const late: IndexEntry = { id: 't--late', title: 'T', name: 'Late', exportName: 'Late', file: '/t.stories.tsx' };

const tModule = {
  Late: story({ timeline: { duration: 1000 }, render: () => <LateSpan /> }),
  default: meta({ title: 'T' }),
  Timed: story({ timeline: { duration: 4000 }, render: () => <Readout /> }),
  Still: story({ render: () => <p>still</p> }),
  Lapped: story({ timeline: { duration: 4000 }, render: () => <Lapped /> }),
};

const importers = () => ({ '/t.stories.tsx': () => Promise.resolve(tModule as unknown as Record<string, unknown>) });

const it = workshopIt({ index: [timed, still, late, lapped], importers });

afterEach(() => {
  lateDelay = 20;
  vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

describe('the workshop helpers', () => {
  it('refuse to mount or resume for a test that has timed out', async () => {
    const timedOut = new AbortController();
    const { mount, until } = harness(timedOut.signal, { index: [timed], importers });
    const waiting = until(() => expect(document.body.dataset.never).toBe('set'), { timeout: 5000 });
    timedOut.abort(new Error('timed out'));
    document.body.dataset.never = 'set';
    await expect(waiting).rejects.toThrow('timed out');
    expect(() => mount('/#/t--timed')).toThrow('timed out');
    expect(screen.queryAllByRole('region', { name: /^Trial / })).toEqual([]);
    delete document.body.dataset.never;
  });

  it('close the act scope a wait for persistence opens before resolving', async ({ lab }) => {
    const start = performance.now();
    await lab.persisted();
    expect(performance.now() - start).toBeGreaterThanOrEqual(390);
  });
});

describe('a story with a timeline, in the workshop', () => {
  it('gets a transport and a scrub bar in its trial, and a story without one gets neither', async ({ lab }) => {
    const { mount, until } = lab;
    mount('/#/t--timed');
    await until(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    expect(within(trial()).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(trial()).getByRole('slider', { name: 'Position' })).toBeInTheDocument();
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('0.00s / 4.00s');

    act(() => {
      location.hash = '#/t--still';
    });
    await until(() => expect(screen.getByText('still')).toBeInTheDocument(), { timeout: 15_000 });
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('advances the playhead the story reads while playing, and holds it in the URL as t once paused', async ({ lab }) => {
    const { mount, until } = lab;
    mount('/#/t--timed');
    await until(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    expect(playhead()).toBe(0);
    fireEvent.click(within(trial()).getByRole('button', { name: 'Play' }));
    await until(() => expect(playhead()).toBeGreaterThan(50));
    expect(tParam()).toBeNull();
    fireEvent.click(within(trial()).getByRole('button', { name: 'Pause' }));
    const held = playhead();
    expect(Number(tParam()) * 1000).toBeCloseTo(held, -1);
    expect(readRoute()).toBe('t--timed');
  });

  it('opens paused at the time a URL holds', async ({ lab }) => {
    const { mount, until } = lab;
    mount('/#/t--timed?t=1.5');
    await until(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    expect(playhead()).toBe(1500);
    expect(within(trial()).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('1.50s / 4.00s');
  });

  it('writes a scrub while paused to the URL, and drops t when the route names another story', async ({ lab }) => {
    const { mount, until } = lab;
    mount('/#/t--timed');
    await until(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    const scrub = within(trial()).getByRole('slider', { name: 'Position' });
    fireEvent.keyDown(scrub, { key: 'End' });
    expect(playhead()).toBe(4000);
    expect(tParam()).toBe('4');
    act(() => {
      location.hash = '#/t--still';
    });
    await until(() => expect(tParam()).toBeNull());
  });
});

describe('a hash change under the open story', () => {
  it('seeks to a t that differs and pauses there, and leaves the clock alone when the hash holds none', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/t--timed');
    await loaded();
    fireEvent.click(within(trial()).getByRole('button', { name: 'Play' }));
    act(() => {
      location.hash = '#/t--timed?t=2';
    });
    await until(() => expect(playhead()).toBe(2000));
    expect(within(trial()).getByRole('button', { name: 'Play' })).toBeInTheDocument();

    fireEvent.keyDown(within(trial()).getByRole('slider', { name: 'Position' }), { key: 'End' });
    act(() => {
      location.hash = '#/t--timed?other=1';
    });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(playhead()).toBe(4000);
  });
});

describe('the playhead kept with the trial', () => {
  it('comes back at its paused time after a reload, and a URL holding t wins over it', async ({ lab }) => {
    const { mount, loaded, persisted } = lab;
    const storage = createMemoryAdapter();
    const first = mount('/#/t--timed', storage);
    await loaded();
    fireEvent.keyDown(within(trial()).getByRole('slider', { name: 'Position' }), { key: 'End' });
    expect(playhead()).toBe(4000);
    await persisted();
    first.unmount();

    const second = mount('/#/t--timed', storage);
    await loaded();
    expect(playhead()).toBe(4000);
    second.unmount();

    mount('/#/t--timed?t=1', storage);
    await loaded();
    expect(playhead()).toBe(1000);
  });

  it('comes back at its paused time when a snapshot is loaded', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/t--timed');
    await loaded();
    const scrub = within(trial()).getByRole('slider', { name: 'Position' });
    fireEvent.keyDown(scrub, { key: 'End' });
    fireEvent.click(screen.getByRole('button', { name: 'probe: save' }));
    fireEvent.keyDown(scrub, { key: 'Home' });
    expect(playhead()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'probe: load' }));
    await until(() => expect(playhead()).toBe(4000));
  });

  it('comes back where it rested when the snapshot was saved before the playhead moved', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/t--timed');
    await loaded();
    const rest = playhead();
    fireEvent.click(screen.getByRole('button', { name: 'probe: save' }));
    fireEvent.keyDown(within(trial()).getByRole('slider', { name: 'Position' }), { key: 'End' });
    expect(playhead()).toBe(4000);
    fireEvent.click(screen.getByRole('button', { name: 'probe: load' }));
    await until(() => expect(playhead()).toBe(rest));
  });

  it('writes the time shown within the pass for a looping clock paused past its first pass', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/t--lapped');
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'probe: lap' }));
    await until(() => expect(tParam()).toBe('1.5'));
    expect(playhead()).toBe(1500);
  });
});

describe('a story that learns its span only once it runs', () => {
  it('lands a URL t beyond the placeholder span once the real one arrives, never rewriting t', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    const replace = vi.spyOn(history, 'replaceState');
    mount('/#/t--late?t=2.5');
    await loaded();
    await until(() => expect(playhead()).toBe(2500));
    expect(tParam()).toBe('2.5');
    const written = replace.mock.calls.map((call) => String(call[2]));
    expect(written.filter((url) => /[?&]t=(?!2\.5\b)/.test(url))).toEqual([]);
  });

  it('keeps the shown time when the span arrives, and comes back at it after a reload', async ({ lab }) => {
    const { mount, until, loaded, persisted } = lab;
    const storage = createMemoryAdapter();
    const first = mount('/#/t--late', storage);
    await loaded();
    await until(() => expect(within(trial()).getByTestId('timeline-time').textContent).toBe('0.00s / 4.00s'));
    expect(playhead()).toBe(0);
    fireEvent.keyDown(within(trial()).getByRole('slider', { name: 'Position' }), { key: 'End' });
    expect(playhead()).toBe(3700);
    await persisted();
    first.unmount();

    // The trial's record keeps the run's length and origin, so a story that never sets its span again reopens at the
    // time it showed, in the length it ran with.
    lateDelay = null;
    const second = mount('/#/t--late', storage);
    await loaded();
    expect(playhead()).toBe(3700);
    await persisted();
    second.unmount();

    lateDelay = 20;
    mount('/#/t--late', storage);
    await loaded();
    await until(() => expect(playhead()).toBe(3700));
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('3.70s / 4.00s');
  });
});

describe('two trials of the routed story', () => {
  it('lets only the focused one write t', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/t--timed');
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'probe: add' }));
    await until(() => expect(playheads()).toHaveLength(2));
    const [older, newer] = screen.getAllByRole('region', { name: /^Trial / });
    fireEvent.keyDown(within(newer!).getByRole('slider', { name: 'Position' }), { key: 'End' });
    expect(tParam()).toBe('4');
    const olderScrub = within(older!).getByRole('slider', { name: 'Position' });
    fireEvent.keyDown(olderScrub, { key: 'End' });
    fireEvent.keyDown(olderScrub, { key: 'Home' });
    expect(playheads()).toEqual([0, 4000]);
    expect(tParam()).toBe('4');
  });

  it('applies a t the URL opens with to that trial alone', async ({ lab }) => {
    const { mount, until, loaded, persisted } = lab;
    const storage = createMemoryAdapter();
    const first = mount('/#/t--timed', storage);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'probe: add' }));
    await until(() => expect(playheads()).toHaveLength(2));
    await persisted();
    first.unmount();

    mount('/#/t--timed?t=1.5', storage);
    await until(() => expect(playheads()).toHaveLength(2), { timeout: 15_000 });
    await until(() => expect(playheads().filter((t) => t === 1500)).toHaveLength(1));
    expect(playheads().filter((t) => t === 0)).toHaveLength(1);
  });
});

const ctx = (story: LoadedStory, config: unknown = {}): StoryContext => ({
  config,
  setConfig: () => {},
  state: null,
  setState: () => {},
  globals: {},
  title: story.title,
  name: story.name,
});

describe('a story with a timeline, outside a trial', () => {
  it('stands at its span start with a clock of its own, as an index page or a frame renders it', () => {
    const [lead] = loadNativeModule(
      { default: meta({ title: 'L' }), Lead: story({ timeline: { duration: 1000, start: -300 }, render: () => <Readout /> }) },
      'L',
    );
    renderWithIcons(<StoryHost story={lead!} ctx={ctx(lead!)} decorators={[]} resetKey={0} onError={() => {}} />);
    expect(playhead()).toBe(-300);
  });

  it('faults a story reading the playhead without declaring a timeline, naming the fix', () => {
    const [bare] = loadNativeModule({ default: meta({ title: 'B' }), Bare: story({ render: () => <Readout /> }) }, 'B');
    const errors: unknown[] = [];
    renderWithIcons(<StoryHost story={bare!} ctx={ctx(bare!)} decorators={[]} resetKey={0} onError={(e) => errors.push(e)} />);
    expect(String(errors[0])).toContain('declares no timeline');
  });

  it("takes a meta's timeline for every story, and a function of the config for a span that follows a control", () => {
    const [byMeta, byConfig] = loadNativeModule(
      {
        default: meta({ title: 'M', timeline: { duration: 500 } }),
        ByMeta: story({ render: () => <SpanReadout /> }),
        ByConfig: story({
          config: f.schema({ length: f.number(2000) }),
          timeline: (config) => ({ duration: config.length }),
          render: () => <SpanReadout />,
        }),
      },
      'M',
    );
    const { unmount } = renderWithIcons(<StoryHost story={byMeta!} ctx={ctx(byMeta!)} decorators={[]} resetKey={0} onError={() => {}} />);
    expect(screen.getByRole('status', { name: 'span' }).textContent).toBe('0..500');
    unmount();
    renderWithIcons(<StoryHost story={byConfig!} ctx={ctx(byConfig!, { length: 2000 })} decorators={[]} resetKey={0} onError={() => {}} />);
    expect(screen.getByRole('status', { name: 'span' }).textContent).toBe('0..2000');
  });

  it("reads a CSF story's parameters.forge.timeline, a function of it being handed the args", () => {
    const [fixed, byArgs] = loadCsfModule(
      {
        default: { title: 'C', parameters: { forge: { timeline: { duration: 800 } } } },
        Fixed: { render: () => null },
        ByArgs: {
          args: { seconds: 3 },
          parameters: { forge: { timeline: (args: { seconds: number }) => ({ duration: args.seconds * 1000 }) } },
          render: () => null,
        },
      },
      'C',
    );
    expect(fixed!.timeline?.({})).toEqual({ duration: 800 });
    expect(byArgs!.timeline?.({ seconds: 5 })).toEqual({ duration: 5000 });
  });
});
