import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCsfModule } from '../csf/loadCsfModule';
import { StoryHost } from '../frame/StoryHost';
import { installResizeObserver } from '../shell/labHarness';
import { readRoute, readRouteParams } from '../shell/useRoute';
import { Workshop } from '../shell/Workshop';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import type { IndexEntry, LoadedStory, StoryContext } from '../story/types';
import { usePlayhead, useTimeline } from './context';

installResizeObserver();

function Readout() {
  return <output aria-label="playhead">{Math.round(usePlayhead())}</output>;
}

function SpanReadout() {
  const { span } = useTimeline();
  return <output aria-label="span">{`${span.start}..${span.end}`}</output>;
}

const timed: IndexEntry = { id: 't--timed', title: 'T', name: 'Timed', exportName: 'Timed', file: '/t.stories.tsx' };
const still: IndexEntry = { id: 't--still', title: 'T', name: 'Still', exportName: 'Still', file: '/t.stories.tsx' };

const tModule = {
  default: meta({ title: 'T' }),
  Timed: story({ timeline: { duration: 4000 }, render: () => <Readout /> }),
  Still: story({ render: () => <p>still</p> }),
};

const importers = () => ({ '/t.stories.tsx': () => Promise.resolve(tModule as unknown as Record<string, unknown>) });

function mount(url: string) {
  history.replaceState(null, '', url);
  return render(
    <Workshop index={[timed, still]} frameUrl="/frame.html" importers={importers()} setup={{}} storage={createMemoryAdapter()} />,
  );
}

const trial = () => screen.getByRole('region', { name: /^Trial / });
const playhead = () => Number(screen.getByRole('status', { name: 'playhead' }).textContent);
const tParam = () => readRouteParams().t ?? null;

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('a story with a timeline, in the workshop', () => {
  it('gets a transport and a scrub bar in its trial, and a story without one gets neither', async () => {
    mount('/#/t--timed');
    await waitFor(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    expect(within(trial()).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(trial()).getByRole('slider', { name: 'Scrub' })).toBeInTheDocument();
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('0.00s / 4.00s');

    act(() => {
      location.hash = '#/t--still';
    });
    await waitFor(() => expect(screen.getByText('still')).toBeInTheDocument(), { timeout: 15_000 });
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('advances the playhead the story reads while playing, and holds it in the URL as t once paused', async () => {
    mount('/#/t--timed');
    await waitFor(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    expect(playhead()).toBe(0);
    fireEvent.click(within(trial()).getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(playhead()).toBeGreaterThan(50));
    expect(tParam()).toBeNull();
    fireEvent.click(within(trial()).getByRole('button', { name: 'Pause' }));
    const held = playhead();
    expect(Number(tParam()) * 1000).toBeCloseTo(held, -1);
    expect(readRoute()).toBe('t--timed');
  });

  it('opens paused at the time a URL holds', async () => {
    mount('/#/t--timed?t=1.5');
    await waitFor(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    expect(playhead()).toBe(1500);
    expect(within(trial()).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('1.50s / 4.00s');
  });

  it('writes a scrub while paused to the URL, and drops t when the route names another story', async () => {
    mount('/#/t--timed');
    await waitFor(() => expect(screen.getByRole('status', { name: 'playhead' })).toBeInTheDocument(), { timeout: 15_000 });
    const scrub = within(trial()).getByRole('slider', { name: 'Scrub' });
    fireEvent.keyDown(scrub, { key: 'End' });
    expect(playhead()).toBe(4000);
    expect(tParam()).toBe('4');
    act(() => {
      location.hash = '#/t--still';
    });
    await waitFor(() => expect(tParam()).toBeNull());
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
    render(<StoryHost story={lead!} ctx={ctx(lead!)} decorators={[]} resetKey={0} onError={() => {}} />);
    expect(playhead()).toBe(-300);
  });

  it('faults a story reading the playhead without declaring a timeline, naming the fix', () => {
    const [bare] = loadNativeModule({ default: meta({ title: 'B' }), Bare: story({ render: () => <Readout /> }) }, 'B');
    const errors: unknown[] = [];
    render(<StoryHost story={bare!} ctx={ctx(bare!)} decorators={[]} resetKey={0} onError={(e) => errors.push(e)} />);
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
    const { unmount } = render(<StoryHost story={byMeta!} ctx={ctx(byMeta!)} decorators={[]} resetKey={0} onError={() => {}} />);
    expect(screen.getByRole('status', { name: 'span' }).textContent).toBe('0..500');
    unmount();
    render(<StoryHost story={byConfig!} ctx={ctx(byConfig!, { length: 2000 })} decorators={[]} resetKey={0} onError={() => {}} />);
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
