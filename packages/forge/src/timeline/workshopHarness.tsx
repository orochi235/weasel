import { createMemoryAdapter, type StorageAdapter, useLabContext } from '@weasel-js/labkit';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { expect, it as base } from 'vitest';
import type { FrameImporters } from '../frame/mountFrame';
import type { StoryChanges } from '../shell/storyChanges';
import { readRouteParams } from '../shell/useRoute';
import { Workshop } from '../shell/Workshop';
import type { IndexEntry } from '../story/types';
import { usePlayhead } from './context';

/** The playhead a story reads, rounded, as a status the tests find by name. */
export function Readout() {
  return <output aria-label="playhead">{Math.round(usePlayhead())}</output>;
}

/** Lab commands the workshop has no button for, as buttons. */
function LabProbe() {
  const lab = useLabContext();
  const first = lab.trials[0];
  const saved = lab.savedSnapshots[0];
  return (
    <>
      <button type="button" onClick={() => first && lab.addTrial(first.instrumentName)}>
        probe: add
      </button>
      <button type="button" onClick={() => first && lab.saveSnapshot(first.id, 'held')}>
        probe: save
      </button>
      <button type="button" onClick={() => first && saved && lab.loadSnapshot(first.id, saved.id)}>
        probe: load
      </button>
    </>
  );
}

const probeConfig = { labChrome: [{ id: 'probe', region: 'header', render: () => <LabProbe /> }] } as const;

/** What a workshop mount shows: the index, the story modules by file, and the edits made to them. */
export interface WorkshopFixture {
  index: IndexEntry[];
  importers: () => FrameImporters;
  changes?: StoryChanges;
}

/**
 * The workshop helpers, bound to one test. A test that times out keeps running after cleanup, and
 * its next mount would land in the following test's document; once its signal aborts, every wait
 * here throws instead of resuming.
 */
export function harness(signal: AbortSignal, fixture: WorkshopFixture) {
  const live = <T,>(value: T): T => {
    signal.throwIfAborted();
    return value;
  };
  const until = <T,>(cb: () => T, options?: Parameters<typeof waitFor>[1]) => waitFor(cb, options).then(live);
  return {
    mount(url: string, storage: StorageAdapter = createMemoryAdapter()) {
      signal.throwIfAborted();
      history.replaceState(null, '', url);
      return renderWithIcons(
        <Workshop
          index={fixture.index}
          frameUrl="/frame.html"
          importers={fixture.importers()}
          setup={{}}
          storage={storage}
          config={probeConfig}
          {...(fixture.changes ? { changes: fixture.changes } : {})}
        />,
      );
    },
    until,
    loaded: () =>
      until(() => expect(screen.getAllByRole('status', { name: 'playhead' }).length).toBeGreaterThan(0), { timeout: 15_000 }),
    /**
     * Past labkit's write-behind, so what the lab holds has reached storage. `act`'s thenable returns nothing from
     * `then`, so chaining on it resolves at once and leaves its scope open, holding back every later `act`'s render.
     */
    persisted: async () => {
      await act(() => new Promise((r) => setTimeout(r, 400)));
      live(undefined);
    },
  };
}

/** A vitest `it` handing each test the workshop helpers over `fixture`. */
export function workshopIt(fixture: WorkshopFixture) {
  return base.extend<{ lab: ReturnType<typeof harness> }>({
    lab: async ({ signal }, provide) => {
      await provide(harness(signal, fixture));
    },
  });
}

export const trial = () => screen.getAllByRole('region', { name: /^Trial / })[0]!;
export const playhead = () => Number(screen.getAllByRole('status', { name: 'playhead' })[0]!.textContent);
export const playheads = () => screen.getAllByRole('status', { name: 'playhead' }).map((el) => Number(el.textContent));
export const tParam = () => readRouteParams().t ?? null;
