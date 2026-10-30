import { createMemoryAdapter, type StorageAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, vi } from 'vitest';
import { installResizeObserver } from '../shell/labHarness';
import { createStoryChanges } from '../shell/storyChanges';
import { meta, story } from '../story/define';
import type { IndexEntry } from '../story/types';
import { useTimeline } from './context';
import * as playheadStories from './Playhead.stories';
import { playhead, Readout, trial, tParam, workshopIt } from './workshopHarness';

// These tests drive the timeline; axe auditing every mounted story only costs them time.
vi.mock('../frame/a11y', async (actual) => ({
  ...(await actual<typeof import('../frame/a11y')>()),
  auditElement: () => Promise.resolve({ ok: false, message: 'not audited here' }),
}));

installResizeObserver();

const entry = (file: string, exportName: string, id: string): IndexEntry => ({
  id,
  title: 'E',
  name: exportName,
  exportName,
  file,
});

const clip = entry('/e.stories.tsx', 'Clip', 'e--clip');
const reach = entry('/e.stories.tsx', 'Reach', 'e--reach');
const saved = entry('/e.stories.tsx', 'Saved', 'e--saved');
const knob = entry('/e.stories.tsx', 'Knob', 'e--knob');
const leadIn: IndexEntry = { ...entry('/p.stories.tsx', 'LeadInOnce', 'p--lead-in-once'), title: 'P' };

/** Sets the real span, 3000 ms, a moment after mount. */
function ReachLater() {
  const { setSpan } = useTimeline();
  useEffect(() => {
    const id = setTimeout(() => setSpan({ duration: 3000 }), 20);
    return () => clearTimeout(id);
  }, [setSpan]);
  return <Readout />;
}

/** Sets a 5 s span once it runs, and offers a control change that redeclares a 3 s one under it. */
function SpanUnderKnob({ setConfig }: { setConfig: (path: string, value: unknown) => void }) {
  const { setSpan } = useTimeline();
  useEffect(() => setSpan({ duration: 5000 }), [setSpan]);
  return (
    <>
      <Readout />
      <button type="button" onClick={() => setConfig('seconds', 3)}>
        three seconds
      </button>
    </>
  );
}

const timedModule = {
  default: meta({ title: 'E' }),
  Clip: story({ timeline: { duration: 4000 }, render: () => <Readout /> }),
  Reach: story({ timeline: { duration: 1000 }, render: () => <ReachLater /> }),
  Knob: story({
    config: f.schema({ seconds: f.number(2) }),
    timeline: (config) => ({ duration: config.seconds * 1000 }),
    render: ({ setConfig }) => <SpanUnderKnob setConfig={setConfig} />,
  }),
  Saved: story({
    config: f.schema({ label: f.string('hi') }),
    timeline: { duration: 4000 },
    render: ({ config }) => (
      <>
        <output aria-label="keys">{Object.keys(config as object).sort().join(',')}</output>
        <Readout />
      </>
    ),
  }),
};
const editedModule = { ...timedModule, Clip: story({ render: () => <p>no timeline</p> }) };

let module: Record<string, unknown> = timedModule;
const changes = createStoryChanges();
const importers = () => ({
  '/e.stories.tsx': () => Promise.resolve(module),
  '/p.stories.tsx': () => Promise.resolve(playheadStories as unknown as Record<string, unknown>),
});

const it = workshopIt({ index: [clip, reach, saved, knob, leadIn], importers, changes });

afterEach(() => {
  module = timedModule;
  vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

/** Writes `$playhead` into every saved trial config, as a trial saved before the shared clock kept it. */
async function keepOldPlayhead(storage: StorageAdapter, ms: number): Promise<void> {
  const touch = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    let hit = false;
    if (record.config && typeof record.config === 'object' && 'label' in record.config) {
      record.config = { ...record.config, $playhead: ms };
      hit = true;
    }
    for (const child of Object.values(record)) hit = touch(child) || hit;
    return hit;
  };
  let found = false;
  for (const [key, value] of await storage.list('')) {
    const copy = structuredClone(value);
    if (touch(copy)) {
      found = true;
      await storage.set(key, copy);
    }
  }
  expect(found).toBe(true);
}

describe('a story edited while its trial is open', () => {
  it('loses its transport when the edit drops its timeline, in the same trial', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/e--clip');
    await loaded();
    const name = trial().getAttribute('aria-label');
    expect(within(trial()).getByRole('button', { name: 'Play' })).toBeInTheDocument();

    act(() => {
      module = editedModule;
      changes.emit('/e.stories.tsx');
    });
    await until(() => expect(screen.getByText('no timeline')).toBeInTheDocument(), { timeout: 15_000 });
    expect(within(trial()).queryByRole('button', { name: 'Play' })).toBeNull();
    expect(trial().getAttribute('aria-label')).toBe(name);
  });
});

describe('a URL t beyond the span a story declares', () => {
  it('lands once setSpan reaches it, and t stays as written meanwhile', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    const replace = vi.spyOn(history, 'replaceState');
    mount('/#/e--reach?t=2.5');
    await loaded();
    await until(() => expect(playhead()).toBe(2500));
    expect(tParam()).toBe('2.5');
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('2.50s / 3.00s');
    const written = replace.mock.calls.map((call) => String(call[2]));
    expect(written.filter((url) => /[?&]t=(?!2\.5\b)/.test(url))).toEqual([]);
  });
});

describe('a URL t on the end of a looping span', () => {
  it('shows the end, not the start of the next pass', async ({ lab }) => {
    const { mount, loaded } = lab;
    mount('/#/e--clip?t=4');
    await loaded();
    expect(playhead()).toBe(4000);
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('4.00s / 4.00s');
    expect(tParam()).toBe('4');
  });
});

describe('a span set at runtime, in a lab', () => {
  it('stands when a control change redeclares the timeline under it', async ({ lab }) => {
    const { mount, until, loaded } = lab;
    mount('/#/e--knob');
    await loaded();
    const readout = () => within(trial()).getByTestId('timeline-time').textContent;
    await until(() => expect(readout()).toBe('0.00s / 5.00s'));
    act(() => screen.getByRole('button', { name: 'three seconds' }).click());
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(readout()).toBe('0.00s / 5.00s');
  });
});

describe('a trial saved while forge kept the playhead in its config', () => {
  it('opens without the old key reaching the story, and the key no longer moves the clock', async ({ lab }) => {
    const { mount, until, loaded, persisted } = lab;
    const storage = createMemoryAdapter();
    const first = mount('/#/e--saved', storage);
    await loaded();
    await persisted();
    first.unmount();
    await keepOldPlayhead(storage, 1200);

    mount('/#/e--saved', storage);
    await loaded();
    await until(() => expect(screen.getByRole('status', { name: 'keys' }).textContent).toBe('label'));
    expect(playhead()).toBe(0);
  });
});

describe('the Playhead stories', () => {
  it('show a lead-in starting below zero at rest', async ({ lab }) => {
    const { mount, until } = lab;
    mount('/#/p--lead-in-once');
    await until(() => expect(screen.getByText(/^Lead-in/)).toBeInTheDocument(), { timeout: 15_000 });
    expect(screen.getByText(/^Lead-in/).textContent).toContain('1.00s to go');
    expect(within(trial()).getByTestId('timeline-time').textContent).toBe('-1.00s / 3.00s');
  });
});
