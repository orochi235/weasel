import '../../../../apps/forge/labkitStyles';
import '../shell/shell.css';
import { createMemoryAdapter } from '@weasel-js/labkit';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { readRouteParams } from '../shell/useRoute';
import { Workshop } from '../shell/Workshop';
import { meta, story } from '../story/define';
import type { IndexEntry } from '../story/types';
import { usePlayhead } from './context';

afterEach(() => {
  cleanup();
  history.replaceState(null, '', location.pathname);
});

function Readout() {
  return <output aria-label="playhead">{Math.round(usePlayhead())}</output>;
}

const timed: IndexEntry = { id: 't--timed', title: 'T', name: 'Timed', exportName: 'Timed', file: '/t.stories.tsx' };
const tModule = { default: meta({ title: 'T' }), Timed: story({ timeline: { duration: 4000 }, render: () => <Readout /> }) };

test("a timeline story's transport lays out in its trial's status bar, plays on real frames, and pauses into t", async () => {
  await page.viewport(1280, 800);
  history.replaceState(null, '', `${location.pathname}#/t--timed`);
  render(
    <div style={{ width: 1200, height: 700 }}>
      <Workshop
        index={[timed]}
        frameUrl="/frame.html"
        importers={{ '/t.stories.tsx': () => Promise.resolve(tModule as unknown as Record<string, unknown>) }}
        setup={{}}
        storage={createMemoryAdapter()}
      />
    </div>,
  );
  const readout = await screen.findByRole('status', { name: 'playhead' }, { timeout: 15_000 });
  const trial = screen.getByRole('region', { name: /^Trial / });
  const scrub = within(trial).getByRole('slider', { name: 'Scrub' });
  const play = within(trial).getByRole('button', { name: 'Play' });

  const trialBox = trial.getBoundingClientRect();
  const scrubBox = scrub.closest('.fg-transport__scrub')!.getBoundingClientRect();
  const playBox = play.getBoundingClientRect();
  expect(scrubBox.width).toBeGreaterThan(80);
  expect(playBox.width).toBeGreaterThan(0);
  expect(playBox.right).toBeLessThanOrEqual(trialBox.right);
  expect(playBox.top).toBeGreaterThan(readout.getBoundingClientRect().bottom);

  play.click();
  await waitFor(() => expect(Number(readout.textContent)).toBeGreaterThan(100));
  within(trial).getByRole('button', { name: 'Pause' }).click();
  await waitFor(() => expect((readRouteParams().t ?? null)).not.toBeNull());
  expect(Number((readRouteParams().t ?? null)) * 1000).toBeCloseTo(Number(readout.textContent), -1);
}, 30_000);
